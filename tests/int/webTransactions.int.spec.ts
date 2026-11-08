// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { listTransactions, loadLookups, editTransaction } = await import('@/lib/web/transactions')
const { parseTxParams } = await import('@/lib/web/filters')

const TZ = 'Asia/Kolkata'

describe('web transactions', () => {
  let payload: Payload
  let me: User
  let other: User
  const stamp = Date.now()
  let decFirstId = ''

  const mkUser = async (tag: string) =>
    (await payload.create({ collection: 'users', data: { email: `webtx-${tag}-${stamp}@example.com`, password: 'x-Test-12345', name: tag } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mkUser('me')
    other = await mkUser('other')
    for (const u of [me, other]) {
      const as = { user: u, overrideAccess: false as const }
      const acc = await payload.create({ collection: 'accounts', data: { name: `Acc ${stamp}` } as any, ...as })
      const cat = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1, ...as })).docs[0]
      const rows = [
        { title: `Nov A ${stamp}`, amount: '101', date: '2026-11-10T06:30:00.000Z' },
        { title: `Nov B ${stamp}`, amount: '102', date: '2026-11-20T06:30:00.000Z' },
        // 00:30 IST on 1 Dec = 19:00 UTC on 30 Nov
        { title: `Dec 1 ${stamp}`, amount: '103', date: '2026-11-30T19:00:00.000Z' },
      ]
      for (const r of rows) {
        const t = await payload.create({ collection: 'transactions', data: { ...r, type: 'expense', category: cat.id, account: acc.id } as any, ...as })
        if (u === me && r.title.startsWith('Dec 1')) decFirstId = String(t.id)
      }
    }
  })

  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      await payload.delete({ collection: 'transactions', where, trash: true } as any)
      for (const c of ['accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('a local-day range includes a 00:30 IST transaction on that day', async () => {
    const lookups = await loadLookups(payload, me)
    const res = await listTransactions(payload, me, parseTxParams({ from: '2026-12-01', to: '2026-12-01', q: String(stamp) }), TZ, lookups)
    expect(res.docs.map((d) => String(d.id))).toEqual([decFirstId])
  })

  it('a page past the end is empty but keeps the totals', async () => {
    const lookups = await loadLookups(payload, me)
    const res = await listTransactions(payload, me, parseTxParams({ q: String(stamp), page: '99' }), TZ, lookups)
    expect(res.docs).toEqual([])
    expect(res.summary.count).toBe(3)
    expect(res.summary.spent).toBe(306)
  })

  it("never lists another user's transactions", async () => {
    const lookups = await loadLookups(payload, me)
    const res = await listTransactions(payload, me, parseTxParams({ q: String(stamp) }), TZ, lookups)
    expect(res.totalDocs).toBe(3)
    expect(res.docs.every((d) => String(typeof d.user === 'object' ? d.user?.id : d.user) === String(me.id))).toBe(true)
  })

  it('sorts by amount', async () => {
    const lookups = await loadLookups(payload, me)
    const res = await listTransactions(payload, me, parseTxParams({ q: String(stamp), sort: 'highest' }), TZ, lookups)
    expect(res.docs.map((d) => Number(d.amount))).toEqual([103, 102, 101])
  })

  it('editing the amount updates amountValue, title and local date', async () => {
    const res = await editTransaction(payload, me, decFirstId, { amount: 250, title: `Edited ${stamp}`, date: '2026-12-02 09:15' }, TZ)
    expect(res).toEqual({ ok: true })
    const t = await payload.findByID({ collection: 'transactions', id: decFirstId, depth: 0 })
    expect(t.amountValue).toBe(250)
    expect(t.title).toBe(`Edited ${stamp}`)
    expect(new Date(t.date).toISOString()).toBe('2026-12-02T03:45:00.000Z')
  })

  it("refuses to edit another user's transaction and leaves it unchanged", async () => {
    const theirs = (await payload.find({ collection: 'transactions', where: { user: { equals: other.id } }, limit: 1, depth: 0 })).docs[0]
    const res = await editTransaction(payload, me, String(theirs.id), { title: 'hijack' }, TZ)
    expect(res).toHaveProperty('error')
    const after = await payload.findByID({ collection: 'transactions', id: theirs.id, depth: 0 })
    expect(after.title).toBe(theirs.title)
  })

  it('rejects a non-positive amount and a bad date', async () => {
    expect(await editTransaction(payload, me, decFirstId, { amount: 0 }, TZ)).toHaveProperty('error')
    expect(await editTransaction(payload, me, decFirstId, { date: 'yesterday' }, TZ)).toHaveProperty('error')
  })
})
