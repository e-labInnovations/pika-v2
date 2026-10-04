import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest'
import type { User } from '@/payload-types'

// The AI is mocked: the test is about what happens around it.
const aiResult = { current: {} as Record<string, unknown> }
vi.mock('@/utilities/ai/service', async (orig) => ({
  ...(await orig<typeof import('@/utilities/ai/service')>()),
  processTextToTransaction: vi.fn(async () => ({ data: aiResult.current, model: 'mock', latencyMs: 1 })),
}))

const { ingestSms } = await import('@/utilities/sms/ingest')
const { replyToSms } = await import('@/utilities/sms/reply')

const upi = (amt: string, to: string, ref: string, when: string) =>
  `Debited Rs ${amt} from a/c X5555 on ${when} via UPI to ${to}. Ref ${ref}.Bal Rs 1000.00. Not you?Call 18004251199 -Federal Bank`

describe('replying to an SMS notification', () => {
  let payload: Payload
  let user: User
  let bank: string
  let cat: { id: string; name: string }
  let friend: string
  const stamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `reply-${stamp}@example.com`, password: 'x-Test-12345', name: 'Reply' } as any,
    })) as User
    bank = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank', smsIdentifiers: 'X5555' } as any })).id)
    const c = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0]
    cat = { id: String(c.id), name: c.name as string }
    friend = String((await payload.create({ collection: 'people', user, overrideAccess: false, data: { name: 'Rony' } as any })).id)
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'people', where })
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('adds the transaction with the split from the reply, keeping the bank amount', async () => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi('300.00', 'SOME CAFE', '627100000401', '03Oct26 13:00'), receivedAt: '2026-10-03T07:30:30Z' },
    ])
    aiResult.current = { title: 'Lunch with Rony', type: 'expense', amount: 999, category: { id: cat.id }, tags: [], person: null,
      shares: [{ person: { id: friend }, amount: '150.00' }] }
    const res = await replyToSms(payload, user, r.id!, 'lunch with @Rony split')
    expect(res).toMatchObject({ status: 'added', summary: { title: 'Lunch with Rony', amount: '300.00', category: cat.name } })
    const tx = await payload.findByID({ collection: 'transactions', id: res.transaction!, depth: 0 })
    expect(parseFloat(tx.amount as string)).toBe(300)
    expect((tx.shares as any[]).map((s) => [s.person, s.amount])).toEqual([[friend, '150.00']])
  })

  it('in review mode, or without a category, saves the suggestion instead', async () => {
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { smsReplyAction: 'review' } as any })
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi('80.00', 'OTHER SHOP', '627100000402', '03Oct26 18:00'), receivedAt: '2026-10-03T12:30:30Z' },
    ])
    aiResult.current = { title: 'Snacks', type: 'expense', category: { id: cat.id }, tags: [] }
    const res = await replyToSms(payload, user, r.id!, 'snacks')
    expect(res).toMatchObject({ status: 'updated', complete: true, summary: { title: 'Snacks' } })
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    expect(sms.status).toBe('pending')
    expect(sms.suggestion).toMatchObject({ title: 'Snacks', category: cat.id, from: 'reply' })
    await expect(replyToSms(payload, user, r.id!, '  ')).rejects.toThrow(/empty/)
  })
})
