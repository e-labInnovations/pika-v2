/**
 * Local sentence-embedding category predictor (MiniLM).
 *
 * Extracted from predict-category.ts so both `processCategoryPrediction` and
 * `processCategorySuggestion` (service.ts) can route to it based on the user's
 * `categoryAiMethod` preference without creating a circular import.
 */

import type { Payload } from 'payload'
import type { Category } from '../../payload-types'
import { cosine, embed, EMBEDDING_MODEL } from './embeddings'
import type { TxType } from './service'
import {
  HISTORY_STRONG_THRESHOLD,
  predictCategoryFromHistory,
} from './user-history'

export type MinilmCategoryPrediction = {
  category: Category | null
  /** Cosine similarity in [-1, 1]; caller compares against SCORE_THRESHOLD. */
  score: number
  model: string
  latencyMs: number
}

/** Minimum cosine similarity required for a match to be considered useful. */
export const SCORE_THRESHOLD = 0.45

type CacheEntry = {
  /**
   * `${id}:${updatedAt}:${parentId}:${parentUpdatedAt}` — a parent rename
   * without a child edit must still invalidate the child's vector, so we bake
   * the parent's stamp into the cache key.
   */
  key: string
  vector: Float32Array
}

/** Module-level cache: categoryId → embedding. Cleared on server restart. */
const categoryEmbeddingCache = new Map<string, CacheEntry>()

type CategoryLike = {
  id?: string | null
  name?: string | null
  description?: string | null
  updatedAt?: string | Date | null
}

/**
 * Text fed to the embedding model. Parent context is useful because many
 * child category names are ambiguous on their own (e.g. "Fuel" → belongs to
 * Transportation vs Utilities). The format is compact natural prose —
 * MiniLM handles this better than structured key/value pairs.
 */
function categoryText(cat: CategoryLike, parent?: CategoryLike | null): string {
  const name = (cat.name ?? '').trim()
  const desc = (cat.description ?? '').trim()
  const parentName = (parent?.name ?? '').trim()
  const parentDesc = (parent?.description ?? '').trim()

  const lead = parentName ? `${parentName} / ${name}` : name
  const context = [desc, parentDesc && !desc ? parentDesc : ''].filter(Boolean).join(' · ')
  return context ? `${lead} — ${context}` : lead
}

function toStamp(v: string | Date | null | undefined): string {
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  return ''
}

async function getCategoryEmbedding(
  cat: CategoryLike & { id: string },
  parent?: CategoryLike | null,
): Promise<Float32Array> {
  const key = `${cat.id}:${toStamp(cat.updatedAt)}:${parent?.id ?? ''}:${toStamp(parent?.updatedAt)}`
  const existing = categoryEmbeddingCache.get(cat.id)
  if (existing && existing.key === key) return existing.vector
  const vector = await embed(categoryText(cat, parent))
  categoryEmbeddingCache.set(cat.id, { key, vector })
  return vector
}

type FetchResult = {
  children: Category[]
  parentById: Map<string, Category>
}

async function fetchChildCategories(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<FetchResult> {
  const sysResult = await payload.find({
    collection: 'users',
    where: { role: { equals: 'system' } },
    limit: 100,
    depth: 0,
  })
  const sysIds = sysResult.docs.map((u) => u.id)
  const ownerOr = [
    { user: { equals: userId } },
    ...(sysIds.length ? [{ user: { in: sysIds } }] : []),
  ]

  // Fetch both parents and children in a single round trip — Categories is
  // one collection so we get both and split below.
  const cats = await payload.find({
    collection: 'categories',
    where: {
      and: [
        { isActive: { equals: true } },
        { type: { equals: txType } },
        { or: ownerOr },
      ],
    },
    limit: 500,
    depth: 0,
  })

  const parentById = new Map<string, Category>()
  const children: Category[] = []
  for (const c of cats.docs as Category[]) {
    if (c.parent) children.push(c)
    else parentById.set(c.id, c)
  }
  return { children, parentById }
}

/**
 * Two-tier local prediction:
 *
 *   Tier 1 — USER HISTORY (k-NN over past transactions)
 *     Runs when the user has ≥ HISTORY_MIN_SAMPLES embedded transactions.
 *     Captures personal vocabulary (merchant shorthand, slang).
 *     Returns early when its score clears HISTORY_STRONG_THRESHOLD.
 *
 *   Tier 2 — CATEGORY NAME/DESCRIPTION
 *     Current behaviour: query title vs parent+name+description embeddings.
 *     Works for cold-start users and brand-new categories.
 *
 * The caller gets whichever tier had the higher confidence (or, if history
 * cleared its strong threshold, it's returned immediately). Score semantics
 * differ slightly between tiers but are comparable as [0, 1] confidence.
 */
export async function predictCategoryWithEmbeddings(
  payload: Payload,
  userId: string,
  args: { type: TxType; title: string },
): Promise<MinilmCategoryPrediction> {
  const overallStart = Date.now()

  // ─── Tier 1: user history ───────────────────────────────────────────────
  let historyBest: MinilmCategoryPrediction | null = null
  try {
    const h = await predictCategoryFromHistory(payload, userId, args)
    if (h && h.category) {
      historyBest = {
        category: h.category,
        score: h.score,
        model: EMBEDDING_MODEL,
        latencyMs: Date.now() - overallStart,
      }
      if (h.score >= HISTORY_STRONG_THRESHOLD) {
        // Strong personal signal — skip the category-name scan.
        return historyBest
      }
    }
  } catch (e) {
    // History tier is best-effort; fall through to category tier.
    console.warn(
      '[minilm] history-tier failed, falling back to category tier:',
      (e as Error)?.message ?? e,
    )
  }

  // ─── Tier 2: category name/description embeddings ───────────────────────
  const categoryBest = await predictFromCategoryEmbeddings(payload, userId, args, overallStart)

  // Pick the higher-confidence tier.
  if (historyBest && historyBest.score > categoryBest.score) return historyBest
  return categoryBest
}

async function predictFromCategoryEmbeddings(
  payload: Payload,
  userId: string,
  args: { type: TxType; title: string },
  start: number,
): Promise<MinilmCategoryPrediction> {
  const { children, parentById } = await fetchChildCategories(payload, userId, args.type)
  if (children.length === 0) {
    return {
      category: null,
      score: 0,
      model: EMBEDDING_MODEL,
      latencyMs: Date.now() - start,
    }
  }

  const parentOf = (child: Category): Category | null => {
    const pid = typeof child.parent === 'string' ? child.parent : child.parent?.id
    return pid ? (parentById.get(pid) ?? null) : null
  }

  const titleVec = await embed(args.title)
  const catVecs = await Promise.all(
    children.map((c) => getCategoryEmbedding(c, parentOf(c))),
  )

  let best: { category: Category; score: number } | null = null
  for (let i = 0; i < children.length; i++) {
    const score = cosine(titleVec, catVecs[i])
    if (!best || score > best.score) best = { category: children[i], score }
  }

  return {
    category: best?.category ?? null,
    score: best?.score ?? 0,
    model: EMBEDDING_MODEL,
    latencyMs: Date.now() - start,
  }
}

/** Reads the user's preferred prediction backend. Defaults to MiniLM. */
export async function resolveUserCategoryMethod(
  payload: Payload,
  userId: string,
): Promise<'minilm' | 'gemini'> {
  try {
    const settings = await payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      context: { internal: true },
    })
    const method = (settings.docs[0] as any)?.categoryAiMethod
    return method === 'gemini' ? 'gemini' : 'minilm'
  } catch {
    return 'minilm'
  }
}
