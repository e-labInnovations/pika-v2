/**
 * Category prediction endpoint backend.
 *
 * Routes between the two implementations based on the user's
 * `categoryAiMethod` preference (UserSettings):
 *   - 'minilm' (default): local sentence embeddings, free + fast
 *   - 'cloud': delegates to processCategorySuggestion (Gemini or HuggingFace)
 *
 * Returns `category: null` when no candidate clears the confidence bar —
 * callers should leave the field empty rather than guess.
 */

import type { Payload } from 'payload'
import { APIError } from 'payload'
import type { Category } from '../../payload-types'
import {
  predictCategoryWithEmbeddings,
  resolveUserCategoryMethod,
  SCORE_THRESHOLD,
} from './minilm'
import {
  logUsage,
  processCategorySuggestion,
  type TxType,
} from './service'

export type AICategoryPredictionResult = {
  category: Category | null
  score: number
  model: string
  latencyMs: number
}

export async function processCategoryPrediction(
  payload: Payload,
  userId: string,
  args: { type: TxType; title: string },
): Promise<AICategoryPredictionResult> {
  // App-level feature flag
  const appSettings = await (payload as any).findGlobal({
    slug: 'app-settings',
    depth: 0,
    context: { internal: true },
  })
  const enabled = appSettings?.ai?.predictionEnabled !== false
  if (!enabled) {
    throw new APIError('Category prediction is disabled', 403, null, true)
  }

  const trimmedTitle = args.title.trim()
  if (!trimmedTitle) {
    throw new APIError('"title" is required', 400, null, true)
  }

  const method = await resolveUserCategoryMethod(payload, userId)
  if (method === 'cloud') {
    // Reuse processCategorySuggestion, shape the result into our shape.
    const result = await processCategorySuggestion(payload, userId, {
      type: args.type,
      title: trimmedTitle,
    })
    return {
      category: result.category,
      score: result.category ? 1 : 0,
      model: result.model,
      latencyMs: result.latencyMs,
    }
  }

  // MiniLM path — run embeddings, apply the confidence threshold, log usage.
  let best: Awaited<ReturnType<typeof predictCategoryWithEmbeddings>> | null = null
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | undefined

  try {
    best = await predictCategoryWithEmbeddings(payload, userId, {
      type: args.type,
      title: trimmedTitle,
    })
  } catch (e: any) {
    status = 'error'
    errorMessage = e?.message ?? 'Prediction failed'
  }

  await logUsage(payload, userId, {
    promptType: 'category-prediction',
    model: best?.model ?? 'Xenova/all-MiniLM-L6-v2',
    apiKeyType: 'local',
    status,
    latencyMs: best?.latencyMs ?? 0,
    error: errorMessage,
  })

  if (status === 'error')
    throw new APIError(errorMessage ?? 'Prediction failed', 500, null, true)

  const passes = !!best?.category && best.score >= SCORE_THRESHOLD
  return {
    category: passes ? best!.category : null,
    score: best?.score ?? 0,
    model: best?.model ?? 'Xenova/all-MiniLM-L6-v2',
    latencyMs: best?.latencyMs ?? 0,
  }
}
