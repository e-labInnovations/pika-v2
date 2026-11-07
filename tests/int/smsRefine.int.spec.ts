import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest'
import type { User } from '@/payload-types'

// The AI is mocked: the test is about what refine sends it and what it saves.
const aiResult = { current: {} as Record<string, unknown> }
const textAI = vi.fn(async (..._args: unknown[]) => ({ data: aiResult.current, model: 'mock', latencyMs: 1 }))
const imageAI = vi.fn(async (..._args: unknown[]) => ({ data: aiResult.current, model: 'mock', latencyMs: 1 }))
vi.mock('@/utilities/ai/service', async (orig) => ({
  ...(await orig<typeof import('@/utilities/ai/service')>()),
  processTextToTransaction: (...a: unknown[]) => textAI(...a),
  processImageToTransaction: (...a: unknown[]) => imageAI(...a),
}))

const { ingestSms } = await import('@/utilities/sms/ingest')
const { refineSms } = await import('@/utilities/sms/refine')
const { confirmCapturedSms } = await import('@/utilities/sms/confirm')

const upi = (amt: string, to: string, ref: string, when: string) =>
  `Debited Rs ${amt} from a/c X5557 on ${when} via UPI to ${to}. Ref ${ref}.Bal Rs 1000.00. Not you?Call 18004251199 -Federal Bank`

describe('refining a pending SMS with AI', () => {
  let payload: Payload
  let user: User
  let cat: string
  const stamp = Date.now()
  let n = 0
  const newSms = async (amount = '120.00', when = '05Nov26 13:10') => {
    n++
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi(amount, 'REFINE CAFE', `6274${(stamp + n) % 1e8}`, when), receivedAt: '2026-11-05T07:40:30Z' },
    ])
    return r.id!
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `refine-${stamp}@example.com`, password: 'x-Test-12345', name: 'Refine' } as any,
    })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: 'Asia/Calcutta' } as any })
    await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank', smsIdentifiers: 'X5557' } as any })
    cat = String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0].id)
  })

  beforeEach(() => {
    textAI.mockClear()
    imageAI.mockClear()
    aiResult.current = { title: 'Lunch with team', type: 'expense', amount: 999, category: { id: cat }, tags: [] }
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('with text: asks the text AI with the text and the SMS, and saves the suggestion without confirming', async () => {
    const id = await newSms()
    const res = await refineSms(payload, user, id, { text: 'team lunch' })

    expect(imageAI).not.toHaveBeenCalled()
    const input = textAI.mock.calls[0][2] as string
    expect(input).toContain('team lunch')
    expect(input).toContain('Bank SMS: Debited Rs 120.00')
    expect(res).toMatchObject({ complete: true, suggestion: { title: 'Lunch with team', category: cat, from: 'ai' } })

    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.status).toBe('pending')
    expect(sms.suggestion).toMatchObject({ title: 'Lunch with team', from: 'ai' })
    // The bank's amount stands; the AI's 999 is ignored.
    expect((sms.parsed as { amount: string }).amount).toBe('120.00')
  })

  it('passes @-mentions typed in the app through to the AI unchanged', async () => {
    const id = await newSms()
    const token = '@[Rony](person:0f8fad5b-d9cb-469f-a165-70867728950e)'
    await refineSms(payload, user, id, { text: `split with ${token}` })
    expect(textAI.mock.calls[0][2] as string).toContain(`split with ${token}`)

    textAI.mockClear()
    await refineSms(payload, user, id, { text: token, image: { base64: 'aGVsbG8=', mimeType: 'image/png' } })
    expect(imageAI.mock.calls[0][5] as string).toContain(token)
  })

  it('with an image: asks the image AI, passing the text and the SMS as its note', async () => {
    const id = await newSms()
    await refineSms(payload, user, id, { text: 'receipt', image: { base64: 'aGVsbG8=', mimeType: 'image/png' } })

    expect(textAI).not.toHaveBeenCalled()
    const [, , base64, mime, , note] = imageAI.mock.calls[0] as unknown[]
    expect([base64, mime]).toEqual(['aGVsbG8=', 'image/png'])
    expect(note).toContain('receipt')
    expect(note).toContain('Bank SMS: Debited Rs 120.00')
  })

  it('try again (no input): re-reads just the SMS, and the meal word follows the time', async () => {
    const id = await newSms()
    aiResult.current = { title: 'Dinner at Refine Cafe', type: 'expense', category: { id: cat }, tags: [] }
    const res = await refineSms(payload, user, id, {})

    expect((textAI.mock.calls[0][2] as string).startsWith('Bank SMS:')).toBe(true)
    // 13:10 IST is lunch.
    expect(res.suggestion.title).toBe('Lunch at Refine Cafe')
  })

  it('keeps the bank\'s direction: a debit stays an expense unless the AI says transfer', async () => {
    let id = await newSms()
    aiResult.current = { title: 'Refund?', type: 'income', category: { id: cat }, tags: [] }
    expect((await refineSms(payload, user, id, { text: 'refund' })).suggestion.type).toBe('expense')
    id = await newSms()
    aiResult.current = { title: 'To savings', type: 'transfer', tags: [] }
    expect((await refineSms(payload, user, id, { text: 'moved to savings' })).suggestion.type).toBe('transfer')
  })

  it('does not write over an SMS confirmed while the AI was running', async () => {
    const id = await newSms('133.00')
    textAI.mockImplementationOnce(async () => {
      await confirmCapturedSms(payload, user, id, { category: cat, title: 'Confirmed meanwhile' })
      return { data: aiResult.current, model: 'mock', latencyMs: 1 }
    })
    await expect(refineSms(payload, user, id, { text: 'late' })).rejects.toMatchObject({ status: 409 })
    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.status).toBe('confirmed')
    expect((sms.suggestion as { from: string }).from).not.toBe('ai')
  })

  it('rejects an SMS that is no longer pending, and over-long text', async () => {
    const id = await newSms()
    await expect(refineSms(payload, user, id, { text: 'x'.repeat(1001) })).rejects.toThrow(/too long/)
    await confirmCapturedSms(payload, user, id, { category: cat })
    await expect(refineSms(payload, user, id, { text: 'late' })).rejects.toMatchObject({ status: 409 })
    expect(textAI).not.toHaveBeenCalled()
  })
})
