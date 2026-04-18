/**
 * Local category prediction using sentence embeddings.
 *
 * This is the "fast, zero-cost, debounced as-you-type" sibling to the
 * Gemini-based `processCategorySuggestion` in ./service.ts. The model (MiniLM
 * L6-v2, ~22MB quantized) runs in-process via transformers.js, so every
 * request costs only CPU/memory — no external API, no rate limits.
 *
 * Per-category embeddings are memo-cached keyed by `${id}:${updatedAt}` so
 * the vector for "Groceries — weekly supermarket" only gets computed once and
 * re-used until that category is edited.
 */

import type { Payload } from 'payload'
import { APIError } from 'payload'
import type { Category } from '../../payload-types'
import { cosine, embed, EMBEDDING_MODEL } from './embeddings'
import { logUsage, type TxType } from './service'

export type AICategoryPredictionResult = {
  category: Category | null
  score: number
  model: string
  latencyMs: number
}

/** Minimum cosine similarity required for the prediction to be surfaced. */
const SCORE_THRESHOLD = 0.45

type CacheEntry = {
  /** `${categoryId}:${updatedAt}` — change in either invalidates the vector. */
  key: string
  vector: Float32Array
}

/** Module-level cache: categoryId → embedding. Cleared on server restart. */
const categoryEmbeddingCache = new Map<string, CacheEntry>()

function categoryText(cat: { name?: string | null; description?: string | null }): string {
  const name = (cat.name ?? '').trim()
  const desc = (cat.description ?? '').trim()
  return desc ? `${name} — ${desc}` : name
}

async function getCategoryEmbedding(cat: {
  id: string
  updatedAt?: string | Date | null
  name?: string | null
  description?: string | null
}): Promise<Float32Array> {
  const stamp =
    typeof cat.updatedAt === 'string'
      ? cat.updatedAt
      : cat.updatedAt instanceof Date
        ? cat.updatedAt.toISOString()
        : ''
  const key = `${cat.id}:${stamp}`
  const existing = categoryEmbeddingCache.get(cat.id)
  if (existing && existing.key === key) return existing.vector
  const vector = await embed(categoryText(cat))
  categoryEmbeddingCache.set(cat.id, { key, vector })
  return vector
}

async function fetchChildCategories(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<Category[]> {
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

  return (cats.docs as Category[]).filter((c) => !!c.parent)
}

/**
 * Predict the best-matching child category for a short title using local
 * sentence embeddings. Returns `category: null` when no candidate clears the
 * score threshold — the caller is expected to leave the field empty in that
 * case rather than guess.
 */
export async function processCategoryPrediction(
  payload: Payload,
  userId: string,
  args: {
    type: TxType
    title: string
  },
): Promise<AICategoryPredictionResult> {
  // Feature flag check — read from app-settings
  const appSettings = await (payload as any).findGlobal({
    slug: 'app-settings',
    depth: 0,
    context: { internal: true },
  })
  const enabled = appSettings?.ai?.predictionEnabled !== false
  if (!enabled) {
    throw new APIError('Local category prediction is disabled', 403, null, true)
  }

  const trimmedTitle = args.title.trim()
  if (!trimmedTitle) {
    throw new APIError('"title" is required', 400, null, true)
  }

  const start = Date.now()
  let best: { category: Category; score: number } | null = null
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | undefined

  try {
    const categories = await fetchChildCategories(payload, userId, args.type)
    if (categories.length === 0) {
      await logUsage(payload, userId, {
        promptType: 'category-prediction',
        model: EMBEDDING_MODEL,
        apiKeyType: 'app',
        status: 'success',
        latencyMs: Date.now() - start,
      })
      return { category: null, score: 0, model: EMBEDDING_MODEL, latencyMs: Date.now() - start }
    }

    // Embed the query and every candidate (category embeddings are memoised)
    const titleVec = await embed(trimmedTitle)
    const catVecs = await Promise.all(categories.map((c) => getCategoryEmbedding(c)))

    for (let i = 0; i < categories.length; i++) {
      const score = cosine(titleVec, catVecs[i])
      if (!best || score > best.score) best = { category: categories[i], score }
    }
  } catch (e: any) {
    status = 'error'
    errorMessage = e?.message ?? 'Prediction failed'
  }

  const latencyMs = Date.now() - start

  await logUsage(payload, userId, {
    promptType: 'category-prediction',
    model: EMBEDDING_MODEL,
    apiKeyType: 'app',
    status,
    latencyMs,
    error: errorMessage,
  })

  if (status === 'error') throw new APIError(errorMessage ?? 'Prediction failed', 500, null, true)

  const passes = best && best.score >= SCORE_THRESHOLD
  return {
    category: passes ? best!.category : null,
    score: best?.score ?? 0,
    model: EMBEDDING_MODEL,
    latencyMs,
  }
}
