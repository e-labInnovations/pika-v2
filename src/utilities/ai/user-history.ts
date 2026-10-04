/**
 * History-based category prediction (k-NN over the user's past transactions).
 *
 * Core idea: a new transaction's category is most strongly predicted by the
 * categories of PAST transactions whose titles embed similarly. This captures
 * user-specific vocabulary (merchant shorthand, private slang, regional
 * spellings) that generic category name embeddings can't.
 *
 * Flow at prediction time:
 *   1. Load up to HISTORY_FETCH_LIMIT of the user's recent embeddings from
 *      the `transaction-embeddings` collection (populated with transaction data).
 *   2. Score the query title against each past title (cosine similarity).
 *   3. Top-K weighted vote on categories.
 *   4. Return the winner IF it clears the score bar — else let the caller
 *      fall back to generic category-name embeddings.
 *
 * Durability:
 *   - Embeddings persist in the `transaction-embeddings` collection (separate
 *     from transactions to keep transaction rows lean). New/edited rows
 *     auto-embed via the afterChange hook on Transactions.
 *   - Pre-existing rows get lazily back-filled in the background the first
 *     time a user's history is needed — predictions work immediately (fall
 *     back to category tier) and sharpen as backfill completes.
 *
 * In-memory cache:
 *   - Per-user per-type snapshot of {categoryId, vector} pairs, invalidated
 *     on every Transactions write. Keeps per-prediction cost at a few
 *     hundred cosines (<1 ms) after first load.
 */

import type { Payload } from 'payload'
import type { Category, Transaction } from '../../payload-types'
import { cosine, embed, EMBEDDING_MODEL } from './embeddings'
import { mentioned } from './names'
import type { TxType } from './service'

// ─── Tunables ───────────────────────────────────────────────────────────────

/** Minimum past transactions required before the history tier is consulted. */
export const HISTORY_MIN_SAMPLES = 10
/** Top-K neighbours to aggregate when voting on a category. */
export const HISTORY_TOP_K = 10
/** Share of the winning category's neighbour weight a tag needs to be suggested. */
const TAG_MAJORITY = 0.5
/**
 * Share of the close neighbours' weight one person needs to be suggested. People are
 * costlier to get wrong than categories (balances), so this is strict; on production
 * history since April it found 45% of people, all right, plus 2 on transactions
 * that had none.
 */
export const PERSON_MAJORITY = 0.7
/** Score above which history-tier wins outright (weighted-sum, already normalised by K). */
export const HISTORY_STRONG_THRESHOLD = 0.5
/**
 * Best-neighbour similarity a suggestion needs before it's filled in without the
 * user asking (bank SMS). On production history (scripts/eval-history.ts) a vote
 * share ≥ 0.5 alone was right 81% of the time; with this added, 89% while still
 * covering 70% of transactions.
 */
export const HISTORY_CONFIDENT_SIM = 0.7
/** How many recent transactions to consider for a single prediction. */
export const HISTORY_FETCH_LIMIT = 500
/** How many rows we back-fill in a single background batch. */
const BACKFILL_BATCH_SIZE = 25
/** Cache TTL. Cleared anyway on any Transactions write via invalidateUserHistoryCache. */
const CACHE_TTL_MS = 10 * 60 * 1000

// ─── Types ──────────────────────────────────────────────────────────────────

export type HistoryPrediction = {
  category: Category | null
  /** Aggregate confidence in [0, 1]; threshold applied by caller. */
  score: number
  /** Number of past transactions that contributed to the winning category. */
  support: number
  /** Tags carried by most of the winning category's neighbours (by similarity weight). */
  tags: string[]
  /** Similarity of the closest past transaction. */
  topSim: number
  /** Person most similar past transactions had, when confident (see isConfidentPerson). */
  person: string | null
  model: string
  latencyMs: number
  /** Total history rows scanned (including those without embeddings yet). */
  totalHistory: number
  /** Rows that contributed a vote (had an embedding). */
  scored: number
}

type TxVector = {
  txId: string
  categoryId: string
  tagIds: string[]
  personId: string | null
  vector: Float32Array
}

type CacheEntry = {
  vectors: TxVector[]
  /** Transactions in the history window that don't have a current embedding yet. */
  missingEmbeddings: number
  loadedAt: number
}

// ─── In-process state ───────────────────────────────────────────────────────

const userHistoryCache = new Map<string, CacheEntry>()
/** Users currently being back-filled; prevents duplicate background jobs. */
const backfillInProgress = new Set<string>()

function cacheKey(userId: string, txType: TxType): string {
  return `${userId}:${txType}`
}

/** Invalidate the history cache for a user (called from afterChange on Transactions). */
export function invalidateUserHistoryCache(userId: string): void {
  for (const key of userHistoryCache.keys()) {
    if (key.startsWith(`${userId}:`)) userHistoryCache.delete(key)
  }
}

// ─── Title embedding (wrapper used by the afterChange hook) ─────────────────

/**
 * Embed a single transaction's title and upsert into `transaction-embeddings`.
 * Fire-and-forget from the caller — errors are swallowed.
 */
export async function scheduleTitleEmbedding(
  payload: Payload,
  txId: string,
  userId: string,
  txType: string,
  title: string,
): Promise<void> {
  if (!title?.trim()) return
  try {
    const vector = await embed(title.trim())
    const embeddingData = {
      titleEmbedding: Array.from(vector),
      titleEmbeddingModel: EMBEDDING_MODEL,
    }

    const existing = await payload.find({
      collection: 'transaction-embeddings',
      where: { transaction: { equals: txId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'transaction-embeddings',
        id: existing.docs[0].id,
        data: embeddingData,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'transaction-embeddings',
        data: { transaction: txId, user: userId, type: txType, ...embeddingData },
        overrideAccess: true,
      })
    }
  } catch (e) {
    // Best-effort — the next prediction query will lazy-backfill.
    console.warn(
      `[user-history] Failed to embed transaction ${txId}:`,
      (e as Error)?.message ?? e,
    )
  }
}

// ─── History loading ─────────────────────────────────────────────────────────

function extractId(rel: unknown): string | null {
  if (!rel) return null
  if (typeof rel === 'string') return rel
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return String((rel as { id: string }).id)
  }
  return null
}

async function loadHistoryVectors(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<CacheEntry> {
  // The latest transactions by their own date — not by embedding creation, which
  // follows imports and backfills rather than when things happened.
  const txRes = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: userId } },
        { type: { equals: txType } },
        { isActive: { equals: true } },
        { category: { exists: true } },
      ],
    },
    sort: '-date',
    limit: HISTORY_FETCH_LIMIT,
    depth: 0,
    select: { category: true, tags: true, person: true },
    overrideAccess: true,
  })
  const txs = txRes.docs as Pick<Transaction, 'id' | 'category' | 'tags' | 'person'>[]

  const embRes = txs.length
    ? await payload.find({
        collection: 'transaction-embeddings',
        where: {
          and: [
            { transaction: { in: txs.map((t) => t.id) } },
            { titleEmbeddingModel: { equals: EMBEDDING_MODEL } },
          ],
        },
        limit: txs.length,
        pagination: false,
        depth: 0,
        select: { transaction: true, titleEmbedding: true },
        overrideAccess: true,
      })
    : { docs: [] }
  const vectorByTx = new Map<string, number[]>()
  for (const d of embRes.docs as any[]) {
    const txId = extractId(d.transaction)
    if (txId && Array.isArray(d.titleEmbedding)) vectorByTx.set(txId, d.titleEmbedding)
  }

  const vectors: TxVector[] = []
  for (const tx of txs) {
    const categoryId = extractId(tx.category)
    const vector = vectorByTx.get(tx.id)
    if (!categoryId || !vector) continue
    vectors.push({
      txId: tx.id,
      categoryId,
      tagIds: Array.isArray(tx.tags) ? (tx.tags.map(extractId).filter(Boolean) as string[]) : [],
      personId: extractId(tx.person),
      vector: Float32Array.from(vector),
    })
  }

  return { vectors, missingEmbeddings: txs.length - vectorByTx.size, loadedAt: Date.now() }
}

// ─── Backfill ────────────────────────────────────────────────────────────────

/**
 * Back-fill missing embeddings in the background. Pages through all transactions
 * for the given user+type, finds those without embeddings, and generates them.
 */
async function runBackfillPass(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<void> {
  let hasNextPage = true
  let page = 1

  while (hasNextPage) {
    const txRes = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { type: { equals: txType } },
          { isActive: { equals: true } },
          { category: { exists: true } },
        ],
      },
      sort: '-date',
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    })

    hasNextPage = txRes.hasNextPage ?? false
    page++

    if (!txRes.docs.length) continue

    const txIds = (txRes.docs as Transaction[]).map((d) => d.id)

    // Which of these already have a current-model embedding?
    const currentEmbRes = await payload.find({
      collection: 'transaction-embeddings',
      where: {
        and: [
          { transaction: { in: txIds } },
          { titleEmbeddingModel: { equals: EMBEDDING_MODEL } },
        ],
      },
      limit: txIds.length,
      depth: 0,
      overrideAccess: true,
    })
    const embeddedTxIds = new Set((currentEmbRes.docs as any[]).map((d) => extractId(d.transaction)))

    const toEmbed = (txRes.docs as Transaction[]).filter((d) => !embeddedTxIds.has(d.id))

    if (!toEmbed.length) continue

    // For the rows to embed, find any existing (stale-model) embedding records so we
    // can update rather than create a duplicate.
    const staleEmbRes = await payload.find({
      collection: 'transaction-embeddings',
      where: { transaction: { in: toEmbed.map((d) => d.id) } },
      limit: toEmbed.length,
      depth: 0,
      overrideAccess: true,
    })
    const staleEmbByTxId = new Map(
      (staleEmbRes.docs as any[]).map((d) => [extractId(d.transaction), d.id as string]),
    )

    let embedded = 0
    for (const doc of toEmbed) {
      const title = doc.title?.trim()
      if (!title) continue
      try {
        const vector = await embed(title)
        const embeddingData = {
          titleEmbedding: Array.from(vector),
          titleEmbeddingModel: EMBEDDING_MODEL,
        }
        const existingEmbId = staleEmbByTxId.get(doc.id)
        if (existingEmbId) {
          await payload.update({
            collection: 'transaction-embeddings',
            id: existingEmbId,
            data: embeddingData,
            overrideAccess: true,
          })
        } else {
          await payload.create({
            collection: 'transaction-embeddings',
            data: { transaction: doc.id, user: userId, type: txType, ...embeddingData },
            overrideAccess: true,
          })
        }
        embedded++
      } catch (e) {
        console.warn(
          `[user-history] Backfill skipped ${doc.id}:`,
          (e as Error)?.message ?? e,
        )
      }
    }

    if (embedded > 0) {
      const key = cacheKey(userId, txType)
      userHistoryCache.delete(key)
    }
  }
}

/**
 * Kick off a background backfill for ALL three transaction types for this user.
 * Idempotent — safe to call repeatedly (duplicate passes short-circuit).
 * Returns immediately; caller can poll `getUserEmbeddingStats` for progress.
 */
export function kickOffUserBackfillAllTypes(payload: Payload, userId: string): void {
  const types: TxType[] = ['expense', 'income', 'transfer']
  for (const t of types) kickOffBackfill(payload, userId, t)
}

/**
 * Count total vs embedded transactions for a user — used by the settings UI
 * to show backfill progress.
 */
export async function getUserEmbeddingStats(
  payload: Payload,
  userId: string,
): Promise<{ total: number; embedded: number; pending: number }> {
  const [totalRes, embeddedRes] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { isActive: { equals: true } },
          { category: { exists: true } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'transaction-embeddings',
      where: {
        and: [
          { user: { equals: userId } },
          { titleEmbeddingModel: { equals: EMBEDDING_MODEL } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const total = totalRes.totalDocs ?? 0
  const embedded = embeddedRes.totalDocs ?? 0
  return { total, embedded, pending: Math.max(0, total - embedded) }
}

function kickOffBackfill(payload: Payload, userId: string, txType: TxType): void {
  const key = cacheKey(userId, txType)
  if (backfillInProgress.has(key)) return
  backfillInProgress.add(key)

  void (async () => {
    try {
      await runBackfillPass(payload, userId, txType)
    } catch (e) {
      console.warn(
        `[user-history] Backfill for ${key} stopped:`,
        (e as Error)?.message ?? e,
      )
    } finally {
      backfillInProgress.delete(key)
    }
  })()
}

// ─── Nearest past transactions (prompt narrowing) ────────────────────────────

export type HistoryNeighbour = { categoryId: string; tagIds: string[]; personId: string | null; sim: number }

async function cachedVectors(payload: Payload, userId: string, txType: TxType): Promise<CacheEntry> {
  const key = cacheKey(userId, txType)
  let cached = userHistoryCache.get(key)
  if (!cached || Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    cached = await loadHistoryVectors(payload, userId, txType)
    userHistoryCache.set(key, cached)
  }
  if (cached.missingEmbeddings > 0) kickOffBackfill(payload, userId, txType)
  return cached
}

/**
 * The user's past transactions (any type) whose titles are closest to `text`, best
 * first. Null when there isn't enough embedded history to say anything.
 */
export async function nearestHistory(payload: Payload, userId: string, text: string, k = 30): Promise<HistoryNeighbour[] | null> {
  const entries = await Promise.all((['expense', 'income', 'transfer'] as TxType[]).map((t) => cachedVectors(payload, userId, t)))
  const vectors = entries.flatMap((e) => e.vectors)
  if (vectors.length < HISTORY_MIN_SAMPLES) return null
  const q = await embed(text)
  return vectors
    .map((v) => ({ categoryId: v.categoryId, tagIds: v.tagIds, personId: v.personId, sim: cosine(q, v.vector) }))
    .filter((n) => n.sim > 0.2)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k)
}

// ─── Prediction (k-NN weighted vote) ────────────────────────────────────────

export type NeighbourVote = {
  categoryId: string
  /** Winner's share of the top-K similarity weight, in [0, 1]. */
  score: number
  /** Neighbours that voted for the winner. */
  support: number
  /** Tags carried by most of the winner's neighbours (by similarity weight). */
  tags: string[]
  /** Similarity of the closest neighbour. */
  topSim: number
  /** Person with the most weight among close top-K neighbours, and their share of it. */
  person: { id: string; share: number } | null
}

/**
 * The weighted vote behind history predictions: the top-K most similar past
 * transactions vote for their category with their similarity. Pure, so the
 * offline evaluation (scripts/eval-history.ts) replays exactly this.
 */
export function voteOnNeighbours(neighbours: HistoryNeighbour[], k = HISTORY_TOP_K): NeighbourVote | null {
  const topK = [...neighbours].sort((a, b) => b.sim - a.sim).slice(0, k).filter((n) => n.sim > 0)
  const votes = new Map<string, { weight: number; count: number }>()
  let total = 0
  for (const n of topK) {
    const acc = votes.get(n.categoryId) ?? { weight: 0, count: 0 }
    acc.weight += n.sim
    acc.count += 1
    votes.set(n.categoryId, acc)
    total += n.sim
  }
  if (!votes.size || total === 0) return null

  let winnerId = ''
  let winner = { weight: 0, count: 0 }
  for (const [id, v] of votes) {
    if (v.weight > winner.weight) {
      winnerId = id
      winner = v
    }
  }

  const tagWeights = new Map<string, number>()
  for (const n of topK) {
    if (n.categoryId !== winnerId) continue
    for (const t of n.tagIds) tagWeights.set(t, (tagWeights.get(t) ?? 0) + n.sim)
  }
  const tags = [...tagWeights]
    .filter(([, w]) => w / winner.weight >= TAG_MAJORITY)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  // People vote among close neighbours only: a few distant ones ("Payment to Azeez"
  // for "Payment to Shamil") shouldn't outweigh exact matches.
  const close = topK.filter((n) => n.sim >= HISTORY_CONFIDENT_SIM)
  const closeTotal = close.reduce((sum, n) => sum + n.sim, 0)
  const personWeights = new Map<string, number>()
  for (const n of close) if (n.personId) personWeights.set(n.personId, (personWeights.get(n.personId) ?? 0) + n.sim)
  const [personId, personWeight] = [...personWeights].sort((a, b) => b[1] - a[1])[0] ?? []
  const person = personId ? { id: personId, share: personWeight! / closeTotal } : null

  return { categoryId: winnerId, score: winner.weight / total, support: winner.count, tags, topSim: topK[0].sim, person }
}


/** Good enough to fill in unasked: a clear majority among close neighbours. */
export function isConfidentPrediction(p: Pick<HistoryPrediction, 'score' | 'topSim'>): boolean {
  return p.score >= HISTORY_STRONG_THRESHOLD && p.topSim >= HISTORY_CONFIDENT_SIM
}

async function loadPeopleNames(payload: Payload, userId: string): Promise<{ id: string; name: string }[]> {
  const res = await payload.find({
    collection: 'people',
    where: { user: { equals: userId } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { name: true },
    overrideAccess: true,
  })
  return res.docs.map((p) => ({ id: String(p.id), name: p.name ?? '' }))
}

/**
 * The person to suggest for a title: the one most close neighbours share, unless the
 * title names someone else ("Lent to Aama" next to many "Lent" rows for Rabeeh). A
 * name alone isn't enough: on an expense a person means they owe you, and titles
 * often name a shop's or payee's owner ("Coffee - MEERA SREEKUMA").
 */
export function pickPerson(
  title: string,
  vote: Pick<NeighbourVote, 'person'> | null,
  people: { id: string; name: string }[],
): string | null {
  const voted = vote?.person && vote.person.share >= PERSON_MAJORITY ? vote.person.id : null
  if (!voted) return null
  const named = mentioned(people, title)
  return named.length === 0 || named.includes(voted) ? voted : null
}

export async function predictCategoryFromHistory(
  payload: Payload,
  userId: string,
  args: { type: TxType; title: string },
): Promise<HistoryPrediction | null> {
  const start = Date.now()
  const key = cacheKey(userId, args.type)

  let cached = userHistoryCache.get(key)
  if (!cached || Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    cached = await loadHistoryVectors(payload, userId, args.type)
    userHistoryCache.set(key, cached)
  }

  // If there are un-embedded rows, schedule background backfill (idempotent).
  if (cached.missingEmbeddings > 0) {
    kickOffBackfill(payload, userId, args.type)
  }

  const totalHistory = cached.vectors.length + cached.missingEmbeddings
  const vectors = cached.vectors
  const empty = (): HistoryPrediction => ({
    category: null,
    score: 0,
    support: 0,
    tags: [],
    topSim: 0,
    person: null,
    model: EMBEDDING_MODEL,
    latencyMs: Date.now() - start,
    totalHistory,
    scored: vectors.length,
  })
  if (vectors.length < HISTORY_MIN_SAMPLES) return empty()

  const titleVec = await embed(args.title)
  const vote = voteOnNeighbours(
    vectors.map((v) => ({ categoryId: v.categoryId, tagIds: v.tagIds, personId: v.personId, sim: cosine(titleVec, v.vector) })),
  )
  if (!vote) return empty()
  const { categoryId: winnerId, score, support: winnerCount, tags, topSim } = vote

  let category: Category | null = null
  if (winnerId) {
    try {
      category = (await payload.findByID({
        collection: 'categories',
        id: winnerId,
        depth: 0,
        overrideAccess: true,
      })) as Category
    } catch {
      category = null
    }
  }

  return {
    category,
    score,
    support: winnerCount,
    tags,
    topSim,
    person: pickPerson(args.title, vote, await loadPeopleNames(payload, userId)),
    model: EMBEDDING_MODEL,
    latencyMs: Date.now() - start,
    totalHistory,
    scored: cached.vectors.length,
  }
}
