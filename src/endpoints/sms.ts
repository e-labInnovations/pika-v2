import type { PayloadHandler } from 'payload'
import type { User } from '@/payload-types'
import { SMS_SENDERS } from '../utilities/sms/parse'
import { ingestSms, type IncomingSms } from '../utilities/sms/ingest'
import { confirmCapturedSms, dismissCapturedSms, type ConfirmOverrides } from '../utilities/sms/confirm'

const MAX_BATCH = 200
const unauthorized = () => Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
const bad = (message: string) => Response.json({ errors: [{ message }] }, { status: 400 })

function errorResponse(e: any): Response {
  const status = typeof e?.status === 'number' ? e.status : 500
  return Response.json({ errors: [{ message: e?.message ?? 'Unknown error', code: e?.data?.code }] }, { status })
}

/**
 * GET /api/sms/senders
 * Sender ID substrings the phone should forward. Served from here so new banks can be
 * added with a deploy instead of an app release.
 */
export const smsSendersHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  return Response.json({ senders: SMS_SENDERS.map((s) => s.pattern) })
}

/**
 * POST /api/sms/ingest
 * Body: { messages: [{ sender, body, receivedAt }] } (at most 200)
 * Safe to retry: an SMS already received is reported as "exists".
 */
export const smsIngestHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  let body: { messages?: unknown } = {}
  try { body = await req.json?.() } catch { return bad('Invalid JSON body') }

  if (!Array.isArray(body.messages)) return bad('"messages" must be an array')
  if (body.messages.length > MAX_BATCH) return bad(`At most ${MAX_BATCH} messages per request`)
  const messages: IncomingSms[] = []
  for (const m of body.messages as Record<string, unknown>[]) {
    const receivedAt = new Date(String(m?.receivedAt ?? ''))
    if (typeof m?.sender !== 'string' || typeof m?.body !== 'string' || !m.body.trim() || isNaN(receivedAt.getTime()))
      return bad('Each message needs "sender", "body" and a valid "receivedAt"')
    messages.push({ sender: m.sender.slice(0, 64), body: m.body.slice(0, 2000), receivedAt: receivedAt.toISOString() })
  }

  try {
    const results = await ingestSms(req.payload, String(req.user.id), messages)
    return Response.json({ results })
  } catch (e) {
    return errorResponse(e)
  }
}

/** POST /api/sms/:id/confirm  Body: optional overrides (title, category, account, tags, …) */
export const smsConfirmHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  let overrides: ConfirmOverrides = {}
  try { overrides = (await req.json?.()) ?? {} } catch { overrides = {} }
  try {
    const result = await confirmCapturedSms(req.payload, req.user as User, String(req.routeParams?.id), overrides)
    return Response.json(result)
  } catch (e) {
    return errorResponse(e)
  }
}

/** POST /api/sms/:id/dismiss */
export const smsDismissHandler: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  try {
    await dismissCapturedSms(req.payload, req.user as User, String(req.routeParams?.id))
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
