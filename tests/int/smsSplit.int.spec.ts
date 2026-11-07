import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest'
import type { User } from '@/payload-types'

// The AI is mocked: the tests are about what split sends it and what it saves.
const aiParts = { current: [] as Record<string, unknown>[] }
const splitAI = vi.fn(async (..._args: unknown[]) => ({ data: { parts: aiParts.current }, model: 'mock', latencyMs: 1 }))
vi.mock('@/utilities/ai/service', async (orig) => ({
  ...(await orig<typeof import('@/utilities/ai/service')>()),
  processTextToSplit: (...a: unknown[]) => splitAI(...a),
}))

const { ingestSms } = await import('@/utilities/sms/ingest')
const { confirmCapturedSms } = await import('@/utilities/sms/confirm')
const { splitSmsWithAI, splitFromGroup, checkPartsTotal } = await import('@/utilities/sms/split')
const { refreshTitleMonth } = await import('@/utilities/sms/mealTitle')
const { resuggestPendingSplits } = await import('@/migrations/20261108_000000_add_sms_split_parts')

const upi = (amt: string, to: string, ref: string, when: string) =>
  `Debited Rs ${amt} from a/c X6623 on ${when} via UPI to ${to}. Ref ${ref}.Bal Rs 1000.00. Not you?Call 18004251199 -Federal Bank`

describe('title month', () => {
  const oct = new Date('2026-10-30T04:01:00Z')
  it('moves a month-year in a reused title to the payment month, keeping its style', () => {
    expect(refreshTitleMonth('Rent - Flat 7A (Aug 2026)', oct, 'Asia/Calcutta')).toBe('Rent - Flat 7A (Oct 2026)')
    expect(refreshTitleMonth('Rent for 7A Flat - July 2026', oct, 'Asia/Calcutta')).toBe('Rent for 7A Flat - October 2026')
    expect(refreshTitleMonth('7A Rent Dec 25', oct, 'Asia/Calcutta')).toBe('7A Rent Oct 26')
    expect(refreshTitleMonth('Electricity Feb 26', oct, 'Asia/Calcutta')).toBe('Electricity Oct 26')
  })
  it('leaves titles without a month-year alone', () => {
    expect(refreshTitleMonth('Flat rent - ASHER MATHEW', oct, 'Asia/Calcutta')).toBe('Flat rent - ASHER MATHEW')
    expect(refreshTitleMonth('May the force', oct, 'Asia/Calcutta')).toBe('May the force')
  })
})

describe('split from a past split payment', () => {
  const rent = { title: 'Flat rent', amount: 7000, category: 'c-rent', tags: [], person: null }
  const elec = { title: 'Flat electricity', amount: 383.67, category: 'c-elec', tags: [], person: null }
  it('keeps the larger part and gives the rest to the other', () => {
    expect(splitFromGroup([elec, rent], '7398.67')).toEqual([
      { title: 'Flat rent', amount: '7000.00', category: 'c-rent', tags: [], person: null },
      { title: 'Flat electricity', amount: '398.67', category: 'c-elec', tags: [], person: null },
    ])
  })
  it('no split when the payment is not more than the larger part', () => {
    expect(splitFromGroup([rent, elec], '7000.00')).toBeNull()
    expect(splitFromGroup([rent, elec], '6500.00')).toBeNull()
  })
  it('only two-part groups', () => {
    expect(splitFromGroup([rent], '7398.67')).toBeNull()
    expect(splitFromGroup([rent, elec, elec], '9000')).toBeNull()
  })
})

describe('parts total', () => {
  const part = (amount: string) => ({ title: 'x', amount, category: 'c', tags: [], person: null })
  it('accepts parts that add up to the bank amount to the paisa', () => {
    expect(() => checkPartsTotal([part('7000.00'), part('398.67')], '7398.67')).not.toThrow()
  })
  it('rejects a wrong total, a single part, and zero or negative parts', () => {
    expect(() => checkPartsTotal([part('7000'), part('398.66')], '7398.67')).toThrow(/7,398.67|7398.67/)
    expect(() => checkPartsTotal([part('7398.67')], '7398.67')).toThrow()
    expect(() => checkPartsTotal([part('7398.67'), part('0')], '7398.67')).toThrow()
    expect(() => checkPartsTotal([part('7400'), part('-1.33')], '7398.67')).toThrow()
  })
})

describe('splitting a pending SMS', () => {
  let payload: Payload
  let user: User
  let account: string
  let rentCat: string
  let elecCat: string
  const stamp = Date.now()
  let n = 0
  const ref = () => `66${(stamp + ++n) % 1e10}`.padEnd(12, '0')
  const newSms = async (amount: string, to = `LANDLORD ${stamp % 1e5}`, when = '30Oct26 09:31') => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AX-FEDBNK-T', body: upi(amount, to, ref(), when), receivedAt: '2026-10-30T04:01:40Z' },
    ])
    return r.id!
  }
  const parts = (a: string, b: string) => [
    { title: 'Rent - Flat (Oct 2026)', amount: a, category: rentCat, tags: [], person: null },
    { title: 'Electricity - Flat', amount: b, category: elecCat, tags: [], person: null },
  ]

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `split-${stamp}@example.com`, password: 'x-Test-12345', name: 'Split' } as any,
    })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: 'Asia/Calcutta' } as any })
    account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank', smsIdentifiers: 'X6623' } as any })).id)
    const cats = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 2 })).docs
    rentCat = String(cats[0].id)
    elecCat = String(cats[1].id)
  })

  beforeEach(() => {
    splitAI.mockClear()
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('confirms into one transaction per part, all with the bank date, account and reference', async () => {
    const id = await newSms('7398.67')
    const res = await confirmCapturedSms(payload, user, id, { parts: parts('7000.00', '398.67') })

    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.status).toBe('confirmed')
    expect(sms.parts).toHaveLength(2)
    expect(String(sms.transaction)).toBe(res.transaction)

    const txs = (await payload.find({ collection: 'transactions', where: { id: { in: sms.parts as string[] } }, depth: 0, sort: '-amount' })).docs
    expect(txs.map((t) => [t.title, Number(t.amount), String(t.category)])).toEqual([
      ['Rent - Flat (Oct 2026)', 7000, rentCat],
      ['Electricity - Flat', 398.67, elecCat],
    ])
    const ref = (sms.parsed as { ref: string }).ref
    for (const t of txs) {
      expect(t.externalRef).toBe(ref)
      expect(String(t.account)).toBe(account)
      expect(t.source).toBe('sms')
      expect(new Date(t.date).toISOString()).toBe('2026-10-30T04:01:00.000Z')
    }
  })

  it('refuses parts that do not add up, and creates nothing', async () => {
    const id = await newSms('7398.67')
    await expect(confirmCapturedSms(payload, user, id, { parts: parts('7000', '300') })).rejects.toMatchObject({ status: 400 })
    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.status).toBe('pending')
  })

  it('removes the parts already created when a later one fails', async () => {
    const id = await newSms('7398.67')
    const before = (await payload.count({ collection: 'transactions', where: { user: { equals: user.id } } })).totalDocs
    const bad = parts('7000.00', '398.67')
    bad[1].category = '00000000-0000-4000-8000-000000000000' // no such category
    await expect(confirmCapturedSms(payload, user, id, { parts: bad })).rejects.toBeTruthy()
    const after = (await payload.count({ collection: 'transactions', where: { user: { equals: user.id } } })).totalDocs
    expect(after).toBe(before)
    expect((await payload.findByID({ collection: 'captured-sms', id, depth: 0 })).status).toBe('pending')
  })

  it('an empty parts list confirms a split suggestion as one transaction', async () => {
    const id = await newSms('7398.67')
    await payload.update({
      collection: 'captured-sms',
      id,
      data: { suggestion: { title: 'Rent', type: 'expense', category: rentCat, tags: [], person: null, toAccount: null, from: 'ai', parts: parts('7000.00', '398.67') } } as any,
    })
    await confirmCapturedSms(payload, user, id, { parts: [] })
    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.parts ?? []).toHaveLength(0)
    expect(Number(((await payload.findByID({ collection: 'transactions', id: String(sms.transaction), depth: 0 })) as any).amount)).toBe(7398.67)
  })

  it('a new SMS to a payee paid as a split last time is suggested split, never auto-confirmed', async () => {
    const to = `ASHER ${stamp % 1e5}`
    const first = await newSms('7383.67', to, '30Sep26 09:31')
    await confirmCapturedSms(payload, user, first, { parts: parts('7000.00', '383.67') })

    const id = await newSms('7411.11', to)
    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    const s = sms.suggestion as { parts?: { amount: string; category: string }[] }
    expect(s.parts?.map((p) => [p.amount, p.category])).toEqual([
      ['7000.00', rentCat],
      ['411.11', elecCat],
    ])
    expect(sms.status).toBe('pending')
  })

  it('history from imported transactions: two past entries sharing a Ref in their notes', async () => {
    const to = `OWNER ${stamp % 1e5}`
    const old = { date: '2026-06-30T05:00:00.000Z', type: 'expense', account }
    await payload.create({ collection: 'transactions', user, overrideAccess: false, data: { ...old, title: 'Flat rent - Owner', amount: 7000, category: rentCat, note: `Debited via UPI to ${to}. Ref: 618105799833. Federal Bank` } as any })
    await payload.create({ collection: 'transactions', user, overrideAccess: false, data: { ...old, title: 'Flat Electricity (Jun 2026)', amount: 383.67, category: elecCat, note: `UPI to ${to}. Ref: 618105799833.` } as any })

    const id = await newSms('7444.44', to)
    const s = (await payload.findByID({ collection: 'captured-sms', id, depth: 0 })).suggestion as {
      parts?: { title: string; amount: string; category: string }[]
      partsFrom?: string
    }
    expect(s.partsFrom).toBe('history')
    expect(s.parts?.map((p) => [p.title, p.amount, p.category])).toEqual([
      ['Flat rent - Owner', '7000.00', rentCat],
      ['Flat Electricity (Oct 2026)', '444.44', elecCat],
    ])
  })

  it('migration: a pending SMS from before gets the split and the right month, once', async () => {
    const to = `TENANT ${stamp % 1e5}`
    const id = await newSms('7455.55', to)
    await payload.update({ collection: 'captured-sms', id, data: { suggestion: { title: 'Rent (Aug 2026)', type: 'expense', category: rentCat, tags: [], person: null, toAccount: null, from: 'note' } } as any })
    const old = { date: '2026-06-30T05:00:00.000Z', type: 'expense', account }
    await payload.create({ collection: 'transactions', user, overrideAccess: false, data: { ...old, title: 'Rent', amount: 7000, category: rentCat, note: `UPI to ${to}. Ref: 618105799999.` } as any })
    await payload.create({ collection: 'transactions', user, overrideAccess: false, data: { ...old, title: 'Electricity', amount: 300, category: elecCat, note: `UPI to ${to}. Ref: 618105799999.` } as any })

    expect(await resuggestPendingSplits(payload)).toBeGreaterThan(0)
    const s = (await payload.findByID({ collection: 'captured-sms', id, depth: 0 })).suggestion as { title: string; parts?: { amount: string }[] }
    expect(s.title).toBe('Rent (Oct 2026)')
    expect(s.parts?.map((p) => p.amount)).toEqual(['7000.00', '455.55'])
    const again = (await payload.findByID({ collection: 'captured-sms', id, depth: 0 })).updatedAt
    await resuggestPendingSplits(payload)
    expect((await payload.findByID({ collection: 'captured-sms', id, depth: 0 })).updatedAt).toBe(again)
  })

  it('migration: reads through its own transaction (sees rows not committed yet)', async () => {
    // In production the migration creates captured_sms_rels and then reads it inside one
    // uncommitted transaction; a read on another connection fails and the split is lost.
    const { createLocalReq } = await import('payload')
    const to = `TXN ${stamp % 1e5}`
    const id = await newSms('7466.66', to)
    const req = await createLocalReq({ user }, payload)
    req.transactionID = (await payload.db.beginTransaction()) ?? undefined
    try {
      const old = { date: '2026-06-30T05:00:00.000Z', type: 'expense', account, user: user.id }
      await payload.create({ collection: 'transactions', req, data: { ...old, title: 'Rent', amount: 7000, category: rentCat, note: `UPI to ${to}. Ref: 618105790001.` } as any })
      await payload.create({ collection: 'transactions', req, data: { ...old, title: 'Electricity', amount: 300, category: elecCat, note: `UPI to ${to}. Ref: 618105790001.` } as any })

      await resuggestPendingSplits(payload, req)
      const s = (await payload.findByID({ collection: 'captured-sms', id, depth: 0, req })).suggestion as { parts?: { amount: string }[] }
      expect(s.parts?.map((p) => p.amount)).toEqual(['7000.00', '466.66'])
    } finally {
      await payload.db.rollbackTransaction(req.transactionID!)
    }
  })

  it('AI split: sends the SMS and the text, saves the parts, the last part takes the rest', async () => {
    const id = await newSms('7422.22')
    aiParts.current = [
      { title: 'Rent', amount: 7000, category: rentCat, tags: [] },
      { title: 'Electricity', amount: 400, category: elecCat, tags: [] },
    ]
    const res = await splitSmsWithAI(payload, user, id, '7000 rent rest electricity')

    const [, , input, total] = splitAI.mock.calls[0] as unknown[]
    expect(input).toContain('7000 rent rest electricity')
    expect(input).toContain('Bank SMS: Debited Rs 7422.22')
    expect(total).toBe('7422.22')
    expect(res.parts.map((p) => [p.title, p.amount, p.category])).toEqual([
      ['Rent', '7000.00', rentCat],
      ['Electricity', '422.22', elecCat],
    ])
    const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0 })
    expect(sms.status).toBe('pending')
    expect((sms.suggestion as { parts?: unknown[] }).parts).toHaveLength(2)
  })

  it('AI split that leaves nothing for the last part is rejected', async () => {
    const id = await newSms('7433.33')
    aiParts.current = [
      { title: 'Rent', amount: 7433.33, category: rentCat, tags: [] },
      { title: 'Electricity', amount: 1, category: elecCat, tags: [] },
    ]
    await expect(splitSmsWithAI(payload, user, id, 'split it')).rejects.toMatchObject({ status: 422 })
  })
})
