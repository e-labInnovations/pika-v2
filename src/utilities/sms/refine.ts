import { APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import { processImageToTransaction, processTextToTransaction } from '../ai/service'
import type { ParsedSms } from './parse'
import type { SmsSuggestion } from './ingest'
import { idOf, suggestionFromAI } from './reply'
import { fixMealWord, userTimeZone } from './mealTitle'

export type RefineInput = {
  /** What the user adds ("team lunch, split with @Rony"). */
  text?: string | null
  /** A receipt or screenshot, base64 without the data-URL prefix. */
  image?: { base64: string; mimeType: string } | null
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** Base64 and type from either a bare base64 string or a data URL. */
function normaliseImage(image: NonNullable<RefineInput['image']>): { base64: string; mimeType: string } {
  const m = image.base64.match(/^data:([^;]+);base64,(.+)$/)
  const out = m ? { base64: m[2], mimeType: m[1] } : { base64: image.base64, mimeType: image.mimeType || 'image/jpeg' }
  if (!IMAGE_TYPES.includes(out.mimeType)) {
    throw new APIError(`Unsupported image type "${out.mimeType}". Allowed: ${IMAGE_TYPES.join(', ')}`, 400, undefined, true)
  }
  return out
}

export type RefineResult = {
  suggestion: SmsSuggestion
  /** Whether one tap (Add) can confirm it. */
  complete: boolean
}

/**
 * Improves a pending SMS's suggestion with the AI. With text and/or an image they are
 * read together with the SMS; with neither ("try again") the AI reads the SMS afresh,
 * without the title learned from past transactions. The result replaces the suggestion
 * and is never confirmed; the bank's amount, time and account are kept.
 */
export async function refineSms(payload: Payload, user: User, id: string, input: RefineInput): Promise<RefineResult> {
  const text = input.text?.trim() ?? ''
  if (text.length > 1000) throw new APIError('Text is too long.', 400, undefined, true)
  const image = input.image?.base64 ? normaliseImage(input.image) : null

  const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0, user, overrideAccess: false })
  if (sms.status !== 'pending') throw new APIError(`This SMS is ${sms.status}, not pending.`, 409, undefined, true)
  const parsed = sms.parsed as ParsedSms | null
  if (!parsed) throw new APIError('This SMS could not be parsed.', 422, undefined, true)
  const before = (sms.suggestion ?? {}) as Partial<SmsSuggestion>
  const userId = String(user.id)

  const bankSms = `Bank SMS: ${sms.body}`
  const ai = image
    ? await processImageToTransaction(payload, userId, image.base64, image.mimeType, null, text ? `${text}\n\n${bankSms}` : bankSms)
    : await processTextToTransaction(payload, userId, text ? `${text}\n\n${bankSms}` : bankSms)
  const d = ai.data as Record<string, any>

  // "Try again" must not fall back to the learned title it is meant to replace.
  const base = text || image ? before : { ...before, title: undefined }
  const s = suggestionFromAI(d, base, parsed, 'ai')
  const at = new Date(parsed.occurredAt ?? (sms.receivedAt as string))
  const suggestion: SmsSuggestion = {
    ...s,
    title: fixMealWord(s.title, at, await userTimeZone(payload, userId)),
    // Still the same payment: keep the "maybe already recorded" hint.
    ...(before.possibleDuplicate ? { possibleDuplicate: before.possibleDuplicate } : {}),
  }

  const account = idOf(sms.account) ?? idOf(d.account)
  const complete = !!suggestion.category && !!account && (suggestion.type !== 'transfer' || !!suggestion.toAccount)

  await payload.update({
    collection: 'captured-sms',
    id,
    user,
    overrideAccess: false,
    data: { suggestion, ...(account ? { account } : {}) } as any,
  })
  return { suggestion, complete }
}
