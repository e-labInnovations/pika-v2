/**
 * History-based category prediction (k-NN over the user's past transactions).
 *
 * Core idea: a new transaction's category is most strongly predicted by the
 * categories of PAST transactions whose titles embed similarly. This captures
 * user-specific vocabulary (merchant shorthand, private slang, regional
 * spellings) that generic category name embeddings can't.
 *
 * Flow at prediction time:
 *   1. Load up to HISTORY_FETCH_LIMIT of the user's recent, categorised,
 *      active transactions of the requested type.
 *   2. Score the query title against each past title (cosine similarity).
 *   3. Top-K weighted vote on categories.
 *   4. Return the winner IF it clears the score bar — else let the caller
 *      fall back to generic category-name embeddings.
 *
 * Durability:
 *   - Embeddings persist in `transactions.titleEmbedding` (see the Transactions
 *     collection). New/edited rows auto-embed via the afterChange hook.
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
  /** How many rows in the DB query didn't have an embedding yet. */
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
 * Embed a single transaction's title and save it back to the row. Uses the
 * low-level db adapter to BYPASS validation + hooks — embeddings are a
 * derived metadata field, and running full doc validation on every write
 * would fail for legacy rows whose relationship fields (Account, Person,
 * …) no longer pass current validators (e.g. a deleted source account).
 * Fire-and-forget from the caller — errors are swallowed.
 */
export async function scheduleTitleEmbedding(
  payload: Payload,
  txId: string,
  title: string,
): Promise<void> {
  if (!title?.trim()) return
  try {
    const vector = await embed(title.trim())
    await payload.db.updateOne({
      collection: 'transactions',
      id: txId,
      data: {
        titleEmbedding: Array.from(vector),
        titleEmbeddingModel: EMBEDDING_MODEL,
      },
      returning: false,
    })
  } catch (e) {
    // Best-effort — the next prediction query will lazy-backfill.
    console.warn(
      `[user-history] Failed to embed transaction ${txId}:`,
      (e as Error)?.message ?? e,
    )
  }
}

// ─── History loading + backfill ─────────────────────────────────────────────

type TxRow = {
  id: string
  title: string
  categoryId: string | null
  titleEmbedding: number[] | null
  titleEmbeddingModel: string | null
}

function extractId(rel: unknown): string | null {
  if (!rel) return null
  if (typeof rel === 'string') return rel
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return String((rel as { id: string }).id)
  }
  return null
}

async function fetchUserHistory(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<TxRow[]> {
  const res = await payload.find({
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
    overrideAccess: true,
  })
  return (res.docs as Transaction[]).map((d) => ({
    id: d.id,
    title: d.title,
    categoryId: extractId(d.category),
    titleEmbedding: (d as any).titleEmbedding ?? null,
    titleEmbeddingModel: (d as any).titleEmbeddingModel ?? null,
  }))
}

function rowToVector(row: TxRow): TxVector | null {
  if (!row.categoryId || !row.titleEmbedding || row.titleEmbeddingModel !== EMBEDDING_MODEL) {
    return null
  }
  return {
    txId: row.id,
    categoryId: row.categoryId,
    vector: Float32Array.from(row.titleEmbedding),
  }
}

async function loadHistoryVectors(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<CacheEntry> {
  const rows = await fetchUserHistory(payload, userId, txType)
  const vectors: TxVector[] = []
  let missing = 0
  for (const r of rows) {
    const v = rowToVector(r)
    if (v) vectors.push(v)
    else missing++
  }
  return { vectors, missingEmbeddings: missing, loadedAt: Date.now() }
}

/**
 * Back-fill up to BACKFILL_BATCH_SIZE missing embeddings in a single background
 * pass. Designed to be chained: when one pass completes, if there are still
 * rows to embed, schedule another. This keeps CPU usage gentle (one title
 * embedding ≈ 30 ms on cold CPU) and avoids hammering the model thread.
 */
async function runBackfillPass(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<{ embedded: number; remaining: number }> {
  // NULL columns don't match `not_equals`, so a plain
  // `titleEmbeddingModel: { not_equals: CURRENT_MODEL }` filter would skip all
  // un-embedded rows. Explicitly OR with `exists: false` to catch them.
  const res = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: userId } },
        { type: { equals: txType } },
        { isActive: { equals: true } },
        { category: { exists: true } },
        {
          or: [
            { titleEmbeddingModel: { exists: false } },
            { titleEmbeddingModel: { not_equals: EMBEDDING_MODEL } },
          ],
        },
      ],
    },
    sort: '-date',
    limit: BACKFILL_BATCH_SIZE,
    depth: 0,
    overrideAccess: true,
  })

  let embedded = 0
  for (const doc of res.docs as Transaction[]) {
    const title = doc.title?.trim()
    if (!title) continue
    try {
      const vector = await embed(title)
      // Low-level adapter write — skips validation + hooks. Required because
      // legacy rows may fail current field validators on unrelated fields
      // (stale Account references, etc.); we don't want that to block
      // writing a derived embedding column.
      await payload.db.updateOne({
        collection: 'transactions',
        id: doc.id,
        data: {
          titleEmbedding: Array.from(vector),
          titleEmbeddingModel: EMBEDDING_MODEL,
        },
        returning: false,
      })
      embedded++
    } catch (e) {
      // Swallow; we'll try the remaining rows and the rest on the next pass.
      console.warn(
        `[user-history] Backfill skipped ${doc.id}:`,
        (e as Error)?.message ?? e,
      )
    }
  }

  return { embedded, remaining: Math.max(0, (res.totalDocs ?? 0) - embedded) }
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
  const baseWhere = {
    user: { equals: userId },
    isActive: { equals: true },
    category: { exists: true },
  }

  const [totalRes, embeddedRes] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: baseWhere,
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        and: [baseWhere, { titleEmbeddingModel: { equals: EMBEDDING_MODEL } }],
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
      // Chain passes until there's nothing left. Gentle on the model thread.
      // Cap total passes as a safety net so a bug can't loop forever.
      for (let i = 0; i < 500; i++) {
        const { embedded, remaining } = await runBackfillPass(payload, userId, txType)
        if (embedded === 0) break
        // Drop cache so the next prediction picks up the freshly-embedded rows.
        userHistoryCache.delete(key)
        if (remaining === 0) break
      }
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
    // Not enough signal to be useful. Let caller fall back to category tier.
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

  // Cosine-similarity score per past transaction
  const perTx: { categoryId: string; sim: number }[] = []
  for (const v of cached.vectors) {
    perTx.push({ categoryId: v.categoryId, sim: cosine(titleVec, v.vector) })
  }
  perTx.sort((a, b) => b.sim - a.sim)

  // Weighted vote over top-K neighbours — positive contributions only.
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

  const score = winnerWeight / totalPositiveWeight // normalised vote share

  // Resolve the full Category object so the caller can return it directly.
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
