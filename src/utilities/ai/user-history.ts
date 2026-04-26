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
import type { TxType } from './service'

// ─── Tunables ───────────────────────────────────────────────────────────────

/** Minimum past transactions required before the history tier is consulted. */
export const HISTORY_MIN_SAMPLES = 10
/** Top-K neighbours to aggregate when voting on a category. */
export const HISTORY_TOP_K = 10
/** Score above which history-tier wins outright (weighted-sum, already normalised by K). */
export const HISTORY_STRONG_THRESHOLD = 0.5
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
  vector: Float32Array
}

type CacheEntry = {
  vectors: TxVector[]
  /** How many categorised transactions for this user+type don't have a current embedding yet. */
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
  // Fetch current-model embeddings with the transaction populated (for category + isActive).
  // Run in parallel with a total-transaction count to determine how many are still un-embedded.
  const [embRes, txCountRes] = await Promise.all([
    payload.find({
      collection: 'transaction-embeddings',
      where: {
        and: [
          { user: { equals: userId } },
          { type: { equals: txType } },
          { titleEmbeddingModel: { equals: EMBEDDING_MODEL } },
        ],
      },
      sort: '-createdAt',
      limit: HISTORY_FETCH_LIMIT,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { type: { equals: txType } },
          { isActive: { equals: true } },
          { category: { exists: true } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const vectors: TxVector[] = []
  for (const d of embRes.docs as any[]) {
    const tx = d.transaction
    if (!tx || typeof tx !== 'object') continue
    if (!tx.isActive || !tx.category) continue
    const categoryId = extractId(tx.category)
    if (!categoryId || !d.titleEmbedding) continue
    vectors.push({
      txId: tx.id,
      categoryId,
      vector: Float32Array.from(d.titleEmbedding as number[]),
    })
  }

  const totalTx = txCountRes.totalDocs ?? 0
  const embeddedTx = embRes.totalDocs ?? 0
  const missingEmbeddings = Math.max(0, totalTx - embeddedTx)

  return { vectors, missingEmbeddings, loadedAt: Date.now() }
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

// ─── Prediction (k-NN weighted vote) ────────────────────────────────────────

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
  if (cached.vectors.length < HISTORY_MIN_SAMPLES) {
    return {
      category: null,
      score: 0,
      support: 0,
      model: EMBEDDING_MODEL,
      latencyMs: Date.now() - start,
      totalHistory,
      scored: cached.vectors.length,
    }
  }

  const titleVec = await embed(args.title)

  const perTx: { categoryId: string; sim: number }[] = []
  for (const v of cached.vectors) {
    perTx.push({ categoryId: v.categoryId, sim: cosine(titleVec, v.vector) })
  }
  perTx.sort((a, b) => b.sim - a.sim)

  const topK = perTx.slice(0, HISTORY_TOP_K)
  const votes = new Map<string, { weight: number; count: number }>()
  let totalPositiveWeight = 0
  for (const n of topK) {
    if (n.sim <= 0) continue
    const acc = votes.get(n.categoryId) ?? { weight: 0, count: 0 }
    acc.weight += n.sim
    acc.count += 1
    votes.set(n.categoryId, acc)
    totalPositiveWeight += n.sim
  }

  if (votes.size === 0 || totalPositiveWeight === 0) {
    return {
      category: null,
      score: 0,
      support: 0,
      model: EMBEDDING_MODEL,
      latencyMs: Date.now() - start,
      totalHistory,
      scored: cached.vectors.length,
    }
  }

  let winnerId: string | null = null
  let winnerWeight = 0
  let winnerCount = 0
  for (const [id, v] of votes) {
    if (v.weight > winnerWeight) {
      winnerId = id
      winnerWeight = v.weight
      winnerCount = v.count
    }
  }

  const score = winnerWeight / totalPositiveWeight

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
    model: EMBEDDING_MODEL,
    latencyMs: Date.now() - start,
    totalHistory,
    scored: cached.vectors.length,
  }
}
