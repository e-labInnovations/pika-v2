import { APIError } from 'payload'

/**
 * Translate errors from the Google Gemini SDK into Payload APIErrors with
 * appropriate HTTP status codes and user-friendly messages. The Gemini SDK
 * surfaces errors whose `.message` contains a prefix plus a JSON blob with
 * `{ error: { code, message, status, details } }` — we parse it, pull the
 * retry delay when present, and hide provider details from the client.
 *
 * Returns null when the error isn't recognisably from Gemini — the caller
 * should then re-throw the original.
 */
export function translateGeminiError(err: unknown): APIError | null {
  const rawMsg = (err as any)?.message
  if (typeof rawMsg !== 'string') return null

  const jsonStart = rawMsg.indexOf('{')
  if (jsonStart === -1) return null

  let parsed: any
  try {
    parsed = JSON.parse(rawMsg.slice(jsonStart))
  } catch {
    return null
  }
  const e = parsed?.error
  if (!e || typeof e !== 'object') return null

  const code = typeof e.code === 'number' ? e.code : 0
  const geminiStatus = typeof e.status === 'string' ? e.status : ''

  let retryAfterSec: number | undefined
  if (Array.isArray(e.details)) {
    for (const d of e.details) {
      if (
        d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
        typeof d.retryDelay === 'string'
      ) {
        const m = d.retryDelay.match(/^(\d+(?:\.\d+)?)s$/)
        if (m) retryAfterSec = Math.ceil(parseFloat(m[1]))
        break
      }
    }
  }

  if (code === 429 || geminiStatus === 'RESOURCE_EXHAUSTED') {
    const retryPart = retryAfterSec
      ? ` Please try again in ~${retryAfterSec}s.`
      : ' Please try again later.'
    return new APIError(
      `AI provider quota reached.${retryPart}`,
      429,
      { code: 'ai_provider_rate_limit', retryAfterSec },
      true,
    )
  }
  if (
    code === 503 ||
    geminiStatus === 'UNAVAILABLE' ||
    geminiStatus === 'DEADLINE_EXCEEDED'
  ) {
    return new APIError(
      'AI service is temporarily unavailable. Please try again in a moment.',
      503,
      { code: 'ai_provider_unavailable' },
      true,
    )
  }
  if (
    code === 401 ||
    code === 403 ||
    geminiStatus === 'UNAUTHENTICATED' ||
    geminiStatus === 'PERMISSION_DENIED'
  ) {
    return new APIError(
      'AI service authentication failed. Please contact support.',
      500,
      { code: 'ai_provider_auth' },
      true,
    )
  }
  if (
    code === 400 ||
    geminiStatus === 'INVALID_ARGUMENT' ||
    geminiStatus === 'FAILED_PRECONDITION'
  ) {
    return new APIError(
      'The AI service could not process this request.',
      400,
      { code: 'ai_provider_bad_request' },
      true,
    )
  }
  return null
}
