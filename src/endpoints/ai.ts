import type { PayloadHandler } from 'payload'
import {
  processTextToTransaction,
  processImageToTransaction,
  processCategorySuggestion,
  type TxType,
} from '../utilities/ai/service'
import { processCategoryPrediction } from '../utilities/ai/predict-category'
import {
  getUserEmbeddingStats,
  kickOffUserBackfillAllTypes,
} from '../utilities/ai/user-history'

const ALLOWED_TX_TYPES: TxType[] = ['income', 'expense', 'transfer']

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function legacyStatus(code: string | undefined): number {
  if (code === 'rate_limit_daily' || code === 'rate_limit_monthly' || code === 'ai_rate_limit') return 429
  if (code === 'ai_service_unavailable') return 503
  if (code === 'ai_disabled') return 403
  if (code === 'no_api_key') return 422
  if (code === 'invalid_model') return 400
  return 500
}

function aiErrorResponse(e: any): Response {
  const status =
    typeof e?.status === 'number' ? e.status : legacyStatus(e?.data?.code ?? e?.code)
  const code = e?.data?.code ?? e?.code
  const body: any = { errors: [{ message: e?.message ?? 'Unknown error', code }] }
  if (e?.data?.retryAfterSec != null) body.errors[0].retryAfterSec = e.data.retryAfterSec
  return Response.json(body, { status })
}

/**
 * POST /api/ai/text-to-transaction
 * Body: { text: string, model?: string }
 * Query: ?model=gemini-2.5-pro
 */
export const textToTransactionHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })

  let body: { text?: string; model?: string } = {}
  try { body = await req.json?.() } catch {
    return Response.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return Response.json({ errors: [{ message: '"text" is required' }] }, { status: 400 })

  const requestedModel = body.model ?? (req.url ? new URL(req.url).searchParams.get('model') : null)

  try {
    const result = await processTextToTransaction(req.payload, String(req.user.id), text, requestedModel)
    return Response.json(result)
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}

/**
 * POST /api/ai/image-to-transaction
 * Body: { image: string (base64 or data URL), mimeType?: string, model?: string }
 * Query: ?model=gemini-2.5-pro
 */
export const imageToTransactionHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })

  let body: { image?: string; mimeType?: string; model?: string } = {}
  try { body = await req.json?.() } catch {
    return Response.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 })
  }

  if (!body.image) return Response.json({ errors: [{ message: '"image" is required (base64)' }] }, { status: 400 })

  // Strip data URL prefix if present
  let imageBase64 = body.image
  let mimeType = body.mimeType ?? 'image/jpeg'
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) { mimeType = dataUrlMatch[1]; imageBase64 = dataUrlMatch[2] }

  if (!ALLOWED_MIME.includes(mimeType)) {
    return Response.json({ errors: [{ message: `Unsupported image type "${mimeType}". Allowed: ${ALLOWED_MIME.join(', ')}` }] }, { status: 400 })
  }

  const requestedModel = body.model ?? (req.url ? new URL(req.url).searchParams.get('model') : null)

  try {
    const result = await processImageToTransaction(req.payload, String(req.user.id), imageBase64, mimeType, requestedModel)
    return Response.json(result)
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}

/**
 * POST /api/ai/suggest-category
 * Body: { type, title, amount?, date?, note?, personId?, model? }
 */
export const suggestCategoryHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })

  let body: {
    type?: string
    title?: string
    amount?: string
    date?: string
    note?: string
    personId?: string
    model?: string
    forceMethod?: string
  } = {}
  try {
    body = await req.json?.()
  } catch {
    return Response.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 })
  }

  const type = typeof body.type === 'string' ? (body.type as TxType) : undefined
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!type || !ALLOWED_TX_TYPES.includes(type)) {
    return Response.json(
      { errors: [{ message: `"type" must be one of: ${ALLOWED_TX_TYPES.join(', ')}` }] },
      { status: 400 },
    )
  }
  if (!title) {
    return Response.json({ errors: [{ message: '"title" is required' }] }, { status: 400 })
  }

  const fm = body.forceMethod
  if (fm && fm !== 'minilm' && fm !== 'gemini') {
    return Response.json(
      { errors: [{ message: '"forceMethod" must be "minilm" or "gemini"' }] },
      { status: 400 },
    )
  }

  const requestedModel = body.model ?? (req.url ? new URL(req.url).searchParams.get('model') : null)

  try {
    const result = await processCategorySuggestion(
      req.payload,
      String(req.user.id),
      {
        type,
        title,
        amount: body.amount || undefined,
        date: body.date || undefined,
        note: body.note || undefined,
        personId: body.personId || undefined,
        forceMethod: fm as 'minilm' | 'gemini' | undefined,
      },
      requestedModel,
    )
    return Response.json(result)
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}

/**
 * POST /api/ai/predict-category
 * Body: { type, title }
 *
 * Fast local prediction using transformers.js sentence embeddings. No Gemini
 * involvement, no rate limits — designed for debounced auto-prefill as the
 * user types a title.
 */
export const predictCategoryHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })

  let body: { type?: string; title?: string } = {}
  try {
    body = await req.json?.()
  } catch {
    return Response.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 })
  }

  const type = typeof body.type === 'string' ? (body.type as TxType) : undefined
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!type || !ALLOWED_TX_TYPES.includes(type)) {
    return Response.json(
      { errors: [{ message: `"type" must be one of: ${ALLOWED_TX_TYPES.join(', ')}` }] },
      { status: 400 },
    )
  }
  if (!title) {
    return Response.json({ errors: [{ message: '"title" is required' }] }, { status: 400 })
  }

  try {
    const result = await processCategoryPrediction(req.payload, String(req.user.id), {
      type,
      title,
    })
    return Response.json(result)
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}

/**
 * POST /api/ai/backfill-embeddings
 *
 * Kicks off a background pass that embeds every transaction title the user has
 * but that doesn't yet carry an up-to-date `titleEmbedding`. Runs for all three
 * transaction types. Idempotent — calling it again while a pass is in flight
 * just returns the current stats.
 */
export const backfillEmbeddingsHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  const userId = String(req.user.id)
  try {
    kickOffUserBackfillAllTypes(req.payload, userId)
    const stats = await getUserEmbeddingStats(req.payload, userId)
    return Response.json({ ...stats, running: true })
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}

/**
 * GET /api/ai/backfill-embeddings/status
 * Returns current embedding coverage for the authenticated user.
 */
export const embeddingsStatusHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  try {
    const stats = await getUserEmbeddingStats(req.payload, String(req.user.id))
    return Response.json(stats)
  } catch (e: any) {
    return aiErrorResponse(e)
  }
}
