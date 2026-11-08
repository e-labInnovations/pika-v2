// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { listTransactions, loadLookups, editTransaction, getOwnTransaction, createTransaction, trashTransaction, splitOwnTransaction } = await import('@/lib/web/transactions')
const { personSummary } = await import('@/lib/web/people')
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
      for (const c of ['accounts', 'people', 'tags', 'media', 'user-settings'] as const) await payload.delete({ collection: c, where })
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

  it('an admin still sees only their own data on the dashboard', async () => {
    const admin = (await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })) as User
    try {
      const otherPerson = await payload.create({ collection: 'people', data: { name: `OtherP ${stamp}` } as any, user: other, overrideAccess: false })
      const theirs = (await payload.find({ collection: 'transactions', where: { user: { equals: other.id } }, limit: 1, depth: 0 })).docs[0]

      const lookups = await loadLookups(payload, admin)
      expect(lookups.accounts.every((a) => a.name === `Acc ${stamp}`) && lookups.accounts.length === 1).toBe(true)
      expect(lookups.people.some((p) => p.id === String(otherPerson.id))).toBe(false)

      const list = await listTransactions(payload, admin, parseTxParams({}), TZ, lookups)
      expect(list.docs.every((d) => String(typeof d.user === 'object' ? d.user?.id : d.user) === String(me.id))).toBe(true)

      expect(await getOwnTransaction(payload, admin, String(theirs.id))).toBeNull()
      expect(await getOwnTransaction(payload, admin, decFirstId)).not.toBeNull()
      expect(await editTransaction(payload, admin, String(theirs.id), { title: 'admin hijack' }, TZ)).toHaveProperty('error')
      expect((await payload.findByID({ collection: 'transactions', id: theirs.id, depth: 0 })).title).toBe(theirs.title)
      expect(await personSummary(payload, admin, String(otherPerson.id))).toBeNull()
      await payload.delete({ collection: 'people', id: otherPerson.id })
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
  })

  describe('add', () => {
    const pick = async (u: User, type: string) => {
      const l = await loadLookups(payload, u)
      return { l, cat: l.categories.find((c) => c.parentId && c.type === type)!, acc: l.accounts[0] }
    }

    it('adds an expense in local time, owned by the user', async () => {
      const { cat, acc } = await pick(me, 'expense')
      const res = await createTransaction(payload, me, { type: 'expense', title: `Added ${stamp}`, amount: 75.5, date: '2026-12-03 20:15', category: cat.id, account: acc.id, tags: [] }, TZ)
      expect(res).toHaveProperty('id')
      const t = await payload.findByID({ collection: 'transactions', id: (res as { id: string }).id, depth: 0 })
      expect(String(t.user)).toBe(String(me.id))
      expect(t.amountValue).toBe(75.5)
      expect(new Date(t.date).toISOString()).toBe('2026-12-03T14:45:00.000Z')
    })

    it('a transfer needs a different destination account', async () => {
      const { cat, acc } = await pick(me, 'transfer')
      const res = await createTransaction(payload, me, { type: 'transfer', title: 'Move', amount: 10, date: '2026-12-03 10:00', category: cat?.id ?? '', account: acc.id, toAccount: acc.id, tags: [] }, TZ)
      expect(res).toHaveProperty('error')
    })

    it("refuses another user's account and validates input", async () => {
      const mine = await pick(me, 'expense')
      const theirs = await pick(other, 'expense')
      expect(await createTransaction(payload, me, { type: 'expense', title: 'x', amount: 5, date: '2026-12-03 10:00', category: mine.cat.id, account: theirs.acc.id, tags: [] }, TZ)).toHaveProperty('error')
      expect(await createTransaction(payload, me, { type: 'expense', title: '', amount: 5, date: '2026-12-03 10:00', category: mine.cat.id, account: mine.acc.id, tags: [] }, TZ)).toHaveProperty('error')
      expect(await createTransaction(payload, me, { type: 'expense', title: 'x', amount: 0, date: '2026-12-03 10:00', category: mine.cat.id, account: mine.acc.id, tags: [] }, TZ)).toHaveProperty('error')
      const count = (await payload.find({ collection: 'transactions', where: { and: [{ user: { equals: me.id } }, { title: { equals: 'x' } }] }, limit: 0 })).totalDocs
      expect(count).toBe(0)
    })
  })

  describe('delete', () => {
    it('moves the user\'s own transaction to the trash (gone from lists, recoverable)', async () => {
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      const made = (await createTransaction(payload, me, { type: 'expense', title: `Trash me ${stamp}`, amount: 9, date: '2026-12-04 10:00', category: cat.id, account: l.accounts[0].id, tags: [] }, TZ)) as { id: string }
      expect(await trashTransaction(payload, me, made.id)).toEqual({ ok: true })
      expect(await getOwnTransaction(payload, me, made.id)).toBeNull()
      const trashed = await payload.findByID({ collection: 'transactions', id: made.id, trash: true, depth: 0 } as any)
      expect((trashed as { deletedAt?: string | null }).deletedAt).toBeTruthy()
    })

    it("refuses another user's transaction, even for an admin", async () => {
      const theirs = (await payload.find({ collection: 'transactions', where: { user: { equals: other.id } }, limit: 1, depth: 0 })).docs[0]
      await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
      try {
        const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
        expect(await trashTransaction(payload, admin, String(theirs.id))).toHaveProperty('error')
        expect((await payload.findByID({ collection: 'transactions', id: theirs.id, depth: 0 })).deletedAt ?? null).toBeNull()
      } finally {
        await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
      }
    })
  })

  describe('split with people', () => {
    it('adds an expense with shares, and edits them', async () => {
      const friend = await payload.create({ collection: 'people', data: { name: `Friend ${stamp}` } as any, user: me, overrideAccess: false })
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      const made = (await createTransaction(payload, me, { type: 'expense', title: `Shared ${stamp}`, amount: 1200, date: '2026-12-05 21:00', category: cat.id, account: l.accounts[0].id, tags: [], shares: [{ person: String(friend.id), amount: 600 }] }, TZ)) as { id: string }
      expect(made).toHaveProperty('id')
      let t = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect(t.shares?.map((x) => [String(x.person), Number(x.amount)])).toEqual([[String(friend.id), 600]])

      expect(await editTransaction(payload, me, made.id, { shares: [{ person: String(friend.id), amount: 400 }] }, TZ)).toEqual({ ok: true })
      t = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect(Number(t.shares?.[0].amount)).toBe(400)

      expect(await editTransaction(payload, me, made.id, { shares: [] }, TZ)).toEqual({ ok: true })
      t = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect(t.shares ?? []).toEqual([])
      await payload.delete({ collection: 'transactions', id: made.id })
      await payload.delete({ collection: 'people', id: friend.id })
    })

    it("refuses shares for someone else's person or that add up to more than the amount", async () => {
      const theirs = await payload.create({ collection: 'people', data: { name: `NotMine ${stamp}` } as any, user: other, overrideAccess: false })
      const mine = await payload.create({ collection: 'people', data: { name: `Mine2 ${stamp}` } as any, user: me, overrideAccess: false })
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      const base = { type: 'expense' as const, title: 'share test', amount: 100, date: '2026-12-05 21:00', category: cat.id, account: l.accounts[0].id, tags: [] }
      expect(await createTransaction(payload, me, { ...base, shares: [{ person: String(theirs.id), amount: 50 }] }, TZ)).toHaveProperty('error')
      expect(await createTransaction(payload, me, { ...base, shares: [{ person: String(mine.id), amount: 150 }] }, TZ)).toHaveProperty('error')
      await payload.delete({ collection: 'people', id: theirs.id })
      await payload.delete({ collection: 'people', id: mine.id })
    })
  })

  describe('attachments', () => {
    // 1x1 transparent PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
    const upload = (u: User, name: string) =>
      payload.create({ collection: 'media', data: { type: 'attachment', entityType: 'transaction' } as any, file: { data: png, mimetype: 'image/png', name, size: png.length }, user: u, overrideAccess: false })

    it('attaches your own files on add and edit; refuses someone else\'s', async () => {
      const mine = await upload(me, `mine-${stamp}.png`)
      const theirs = await upload(other, `theirs-${stamp}.png`)
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      const base = { type: 'expense' as const, title: `Receipt ${stamp}`, amount: 40, date: '2026-12-06 12:00', category: cat.id, account: l.accounts[0].id, tags: [] }

      expect(await createTransaction(payload, me, { ...base, attachments: [String(theirs.id)] }, TZ)).toHaveProperty('error')
      const made = (await createTransaction(payload, me, { ...base, attachments: [String(mine.id)] }, TZ)) as { id: string }
      let t = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect((t.attachments ?? []).map(String)).toEqual([String(mine.id)])

      expect(await editTransaction(payload, me, made.id, { attachments: [String(theirs.id)] }, TZ)).toHaveProperty('error')
      expect(await editTransaction(payload, me, made.id, { attachments: [] }, TZ)).toEqual({ ok: true })
      t = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect(t.attachments ?? []).toEqual([])

      await payload.delete({ collection: 'transactions', id: made.id })
      await payload.delete({ collection: 'media', id: mine.id })
      await payload.delete({ collection: 'media', id: theirs.id })
    })
  })

  describe('split into parts', () => {
    it('splits the user\'s transaction into parts that add up', async () => {
      const l = await loadLookups(payload, me)
      const cats = l.categories.filter((c) => c.parentId && c.type === 'expense')
      const made = (await createTransaction(payload, me, { type: 'expense', title: `Rent+EB ${stamp}`, amount: 1000, date: '2026-12-07 09:00', category: cats[0].id, account: l.accounts[0].id, tags: [] }, TZ)) as { id: string }
      expect(await splitOwnTransaction(payload, me, made.id, [{ title: 'Rent', amount: 900, category: cats[0].id }, { title: 'EB', amount: 50, category: cats[1].id }])).toHaveProperty('error') // 950 ≠ 1000
      const res = await splitOwnTransaction(payload, me, made.id, [{ title: 'Rent', amount: 900, category: cats[0].id }, { title: 'EB', amount: 100, category: cats[1].id }])
      expect(res).toHaveProperty('ids')
      const ids = (res as { ids: string[] }).ids
      expect(ids).toHaveLength(2)
      const docs = await Promise.all(ids.map((id) => payload.findByID({ collection: 'transactions', id, depth: 0 })))
      expect(docs.map((d) => Number(d.amount)).sort((a, b) => a - b)).toEqual([100, 900])
    })

    it("refuses someone else's transaction and foreign categories", async () => {
      const theirs = (await payload.find({ collection: 'transactions', where: { user: { equals: other.id } }, limit: 1, depth: 0 })).docs[0]
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      expect(await splitOwnTransaction(payload, me, String(theirs.id), [{ title: 'a', amount: Number(theirs.amount), category: cat.id }])).toHaveProperty('error')
    })
  })

  describe('duplicates', () => {
    it('holds back a likely duplicate unless allowed', async () => {
      const l = await loadLookups(payload, me)
      const cat = l.categories.find((c) => c.parentId && c.type === 'expense')!
      const base = { type: 'expense' as const, title: `Coffee ${stamp}`, amount: 187, date: '2026-12-08 08:10', category: cat.id, account: l.accounts[0].id, tags: [] }
      const first = await createTransaction(payload, me, base, TZ)
      expect(first).toHaveProperty('id')
      const again = await createTransaction(payload, me, { ...base, date: '2026-12-08 08:12' }, TZ)
      expect(again).toHaveProperty('duplicate')
      expect((again as { duplicate: { id: string } }).duplicate.id).toBe((first as { id: string }).id)
      const forced = await createTransaction(payload, me, { ...base, date: '2026-12-08 08:12', allowDuplicate: true }, TZ)
      expect(forced).toHaveProperty('id')
    })
  })

  describe('split keeps the original', () => {
    it("part 1 keeps the transaction's title, tags and person unless given", async () => {
      const friend = await payload.create({ collection: 'people', data: { name: `Landlord ${stamp}` } as any, user: me, overrideAccess: false })
      const tag = await payload.create({ collection: 'tags', data: { name: `home ${stamp}`, icon: 'house' } as any, user: me, overrideAccess: false })
      const l = await loadLookups(payload, me)
      const cats = l.categories.filter((c) => c.parentId && c.type === 'expense')
      const made = (await createTransaction(payload, me, { type: 'expense', title: `Rent+EB keep ${stamp}`, amount: 1000, date: '2026-12-10 09:00', category: cats[0].id, account: l.accounts[0].id, tags: [String(tag.id)], person: String(friend.id), allowDuplicate: true }, TZ)) as { id: string }
      const res = (await splitOwnTransaction(payload, me, made.id, [{ title: '', amount: 900, category: cats[0].id }, { title: 'EB', amount: 100, category: cats[1].id }])) as { ids: string[] }
      expect(res.ids).toBeDefined()
      const first = await payload.findByID({ collection: 'transactions', id: made.id, depth: 0 })
      expect(first.title).toBe(`Rent+EB keep ${stamp}`)
      expect((first.tags ?? []).map(String)).toEqual([String(tag.id)])
      expect(String(first.person)).toBe(String(friend.id))
    })
  })

  it('malformed ids are refused with an error, not a crash', async () => {
    expect(await editTransaction(payload, me, decFirstId, { shares: [{ person: 'not-a-uuid', amount: 1 }] }, TZ)).toHaveProperty('error')
    expect(await editTransaction(payload, me, decFirstId, { attachments: ['nope'] }, TZ)).toHaveProperty('error')
    expect(await splitOwnTransaction(payload, me, decFirstId, 'x' as never)).toHaveProperty('error')
  })
})
