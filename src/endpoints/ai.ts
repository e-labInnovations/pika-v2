import type { PayloadHandler } from 'payload'
import { processTextToTransaction, processImageToTransaction } from '../utilities/ai/service'

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function errorStatus(code: string | undefined): number {
  if (code === 'rate_limit_daily' || code === 'rate_limit_monthly' || code === 'ai_rate_limit') return 429
  if (code === 'ai_service_unavailable') return 503
  if (code === 'ai_disabled') return 403
  if (code === 'no_api_key') return 422
  if (code === 'invalid_model') return 400
  return 500
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
    return Response.json({ errors: [{ message: e.message, code: e.code }] }, { status: errorStatus(e.code) })
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
    return Response.json({ errors: [{ message: e.message, code: e.code }] }, { status: errorStatus(e.code) })
  }
}
