import { APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import { processTextToTransaction } from '../ai/service'
import type { ParsedSms } from './parse'
import type { SmsSuggestion } from './ingest'
import { confirmCapturedSms, type ConfirmOverrides } from './confirm'

export type ReplyResult = {
  /** `added`: confirmed into `transaction`; `updated`: the suggestion now reflects the reply. */
  status: 'added' | 'updated'
  transaction?: string
  /** `updated` only: whether one tap (Add) can confirm it. */
  complete?: boolean
  summary: { amount: string; type: ParsedSms['type']; title: string; category: string | null }
}

const idOf = (v: unknown): string | null =>
  v == null ? null : String(typeof v === 'object' ? (v as { id: string }).id : v)

/**
 * The user replied to a "new transaction" notification ("lunch with @Rony, split").
 * The reply and the SMS go to text-to-transaction; the bank's amount and time stay.
 * Depending on the user's setting the result is confirmed, or saved as the suggestion.
 */
export async function replyToSms(payload: Payload, user: User, id: string, text: string): Promise<ReplyResult> {
  const reply = text.trim()
  if (!reply) throw new APIError('Reply is empty.', 400, undefined, true)
  if (reply.length > 1000) throw new APIError('Reply is too long.', 400, undefined, true)

  const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0, user, overrideAccess: false })
  if (sms.status !== 'pending') throw new APIError(`This SMS is ${sms.status}, not pending.`, 409, undefined, true)
  const parsed = sms.parsed as ParsedSms | null
  if (!parsed) throw new APIError('This SMS could not be parsed.', 422, undefined, true)
  const before = (sms.suggestion ?? {}) as Partial<SmsSuggestion>
  const userId = String(user.id)

  const ai = await processTextToTransaction(payload, userId, `${reply}\n\nBank SMS: ${sms.body}`)
  const d = ai.data as Record<string, any>

  const shares = Array.isArray(d.shares)
    ? (d.shares as { person?: { id: string } | null; amount: string }[])
        .filter((s) => s.person?.id)
        .map((s) => ({ person: String(s.person!.id), amount: String(s.amount) }))
    : []
  const type: ParsedSms['type'] = shares.length ? 'expense' : (d.type as ParsedSms['type']) ?? before.type ?? parsed.type
  const suggestion: SmsSuggestion = {
    title: (d.title as string)?.trim() || before.title || 'Transaction',
    type,
    category: idOf(d.category) ?? before.category ?? null,
    tags: Array.isArray(d.tags) && d.tags.length ? d.tags.map(idOf).filter((t: string | null): t is string => !!t) : before.tags ?? [],
    person: type === 'transfer' ? null : idOf(d.person) ?? before.person ?? null,
    toAccount: type === 'transfer' ? idOf(d.toAccount) ?? before.toAccount ?? null : null,
    shares,
    from: 'reply',
  }
  const account = idOf(sms.account) ?? idOf(d.account)
  const complete = !!suggestion.category && !!account && (type !== 'transfer' || !!suggestion.toAccount)
  const summary = { amount: parsed.amount, type, title: suggestion.title, category: null as string | null }
  if (suggestion.category) {
    const cat = await payload.findByID({ collection: 'categories', id: suggestion.category, depth: 0 }).catch(() => null)
    summary.category = (cat?.name as string) ?? null
  }

  const settings = await payload.find({
    collection: 'user-settings',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    context: { internal: true },
    select: { smsReplyAction: true },
  })
  const action = settings.docs[0]?.smsReplyAction ?? 'add'

  if (action === 'add' && complete) {
    const overrides: ConfirmOverrides = {
      title: suggestion.title,
      type,
      category: suggestion.category!,
      account: account!,
      toAccount: suggestion.toAccount,
      person: suggestion.person,
      tags: suggestion.tags,
      shares,
    }
    const { transaction } = await confirmCapturedSms(payload, user, id, overrides)
    return { status: 'added', transaction, summary }
  }

  await payload.update({
    collection: 'captured-sms',
    id,
    user,
    overrideAccess: false,
    data: { suggestion, ...(account ? { account } : {}) },
  })
  return { status: 'updated', complete, summary }
}
