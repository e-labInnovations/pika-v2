import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { parseLocalDate, formatLocal } = await import('@/utilities/mcp/time')
const { loadContext } = await import('@/utilities/mcp/context')
const { makeResolver } = await import('@/utilities/mcp/resolve')
const { addTransactions, updateTransactions, deleteTransactions, searchTransactions } = await import('@/utilities/mcp/transactions')
const { smsQueue, getBalances, getOverview } = await import('@/utilities/mcp/more')
const { pikaTools } = await import('@/plugins/mcp-tools')

const TZ = 'Asia/Calcutta'

describe('MCP dates', () => {
  it('reads plain dates and times as local, exact ISO as given', () => {
    expect(parseLocalDate('2026-11-07 14:30', TZ).toISOString()).toBe('2026-11-07T09:00:00.000Z')
    expect(parseLocalDate('2026-11-07T14:30:00', TZ).toISOString()).toBe('2026-11-07T09:00:00.000Z')
    expect(parseLocalDate('2026-11-07', TZ).toISOString()).toBe('2026-11-07T06:30:00.000Z') // noon local
    expect(parseLocalDate('2026-11-07T14:30:00Z', TZ).toISOString()).toBe('2026-11-07T14:30:00.000Z')
    expect(parseLocalDate('2026-11-07T14:30:00+05:30', TZ).toISOString()).toBe('2026-11-07T09:00:00.000Z')
  })
  it('rejects nonsense with a hint', () => {
    expect(() => parseLocalDate('yesterday', TZ)).toThrow(/YYYY-MM-DD/)
    expect(() => parseLocalDate('2026-13-40', TZ)).toThrow()
  })
  it('formats in local time with the offset', () => {
    expect(formatLocal(new Date('2026-11-07T09:00:00Z'), TZ)).toBe('2026-11-07 14:30 (+05:30)')
  })
})

describe('MCP tools', () => {
  let payload: Payload
  let user: User
  const stamp = Date.now()
  let food: { id: string; name: string; parent: string }
  let sibling: { id: string; name: string }
  let incomeCat: { id: string; name: string }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({ collection: 'users', data: { email: `mcp-${stamp}@example.com`, password: 'x-Test-12345', name: 'Mcp' } as any })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: TZ } as any })
    for (const name of [`Federal ${stamp}`, `Cash ${stamp}`]) {
      await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name } as any })
    }
    await payload.create({ collection: 'people', user, overrideAccess: false, data: { name: `Rony ${stamp}` } as any })
    await payload.create({ collection: 'tags', user, overrideAccess: false, data: { name: `Office ${stamp}`, icon: 'tag' } as any })
    // Only categories this user can see (their own and system ones).
    const ctx = await loadContext(payload, user)
    const kids = ctx.categories.filter((c) => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name))
    const k = kids[0]
    food = { id: k.id, name: k.name, parent: String(k.parent) }
    const sib = kids.find((x) => x.parentId !== k.parentId && !x.name.toLowerCase().includes(k.name.toLowerCase()))!
    sibling = { id: sib.id, name: sib.name }
    const inc = ctx.categories.find((c) => c.type === 'income' && !ctx.categories.some((e) => e.type === 'expense' && e.name === c.name))!
    incomeCat = { id: inc.id, name: inc.name }
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    for (const c of ['tags', 'people', 'accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  describe('context and names', () => {
    it('context lists accounts, categories (tree), tags and people with ids, and the timezone', async () => {
      const ctx = await loadContext(payload, user)
      expect(ctx.timezone).toBe(TZ)
      expect(ctx.accounts.map((a) => a.name)).toEqual(expect.arrayContaining([`Federal ${stamp}`, `Cash ${stamp}`]))
      expect(ctx.categories.find((c) => c.id === food.id)?.parent).toBe(food.parent)
    })

    it('resolves exact, partial, Parent > Child and ids; reports ambiguity and wrong types', async () => {
      const r = makeResolver(await loadContext(payload, user))
      expect(r.account(`federal ${stamp}`)).toEqual({ id: expect.any(String) })
      expect(r.account('Federal')).toEqual({ id: expect.any(String) }) // unique partial
      expect(r.account(String(stamp))).toMatchObject({ error: expect.stringMatching(/2 accounts match/) })
      expect(r.category(food.name, 'expense')).toEqual({ id: food.id })
      expect(r.category(`${food.parent} > ${food.name}`, 'expense')).toEqual({ id: food.id })
      expect(r.category(food.id, 'expense')).toEqual({ id: food.id })
      expect(r.category(incomeCat.name, 'expense')).toMatchObject({ error: expect.stringMatching(/income/) })
      expect(r.category('zzzz-none', 'expense')).toMatchObject({ error: expect.stringMatching(/No expense category/) })
      expect(r.person('rony')).toEqual({ id: expect.any(String) })
      expect(r.tag(`office ${stamp}`)).toEqual({ id: expect.any(String) })
    })
  })

  describe('add / update / delete', () => {
    it('adds a batch: local times stored correctly, names resolved, bad items reported, nothing else blocked', async () => {
      const res = await addTransactions(payload, user, {
        transactions: [
          { title: 'Lunch', amount: 250, date: '2026-11-07 13:15', type: 'expense', category: food.name, account: 'Federal', tags: [`Office ${stamp}`] },
          { title: 'Salary', amount: 50000, date: '2026-11-01', type: 'income', category: incomeCat.name, account: `Cash ${stamp}` },
          { title: 'Broken', amount: 10, date: '2026-11-07 10:00', type: 'expense', category: 'zzzz-none', account: 'Federal' },
        ],
      })
      expect(res.results.map((x) => x.status)).toEqual(['created', 'created', 'error'])
      expect(res.results[2].errors?.join(' ')).toMatch(/No expense category/)
      const lunch = await payload.findByID({ collection: 'transactions', id: res.results[0].id!, depth: 0 })
      expect(new Date(lunch.date).toISOString()).toBe('2026-11-07T07:45:00.000Z')
      expect(String(lunch.category)).toBe(food.id)
      expect(lunch.tags).toHaveLength(1)
    })

    it('dry run saves nothing; a likely duplicate is skipped unless allowed', async () => {
      const dry = await addTransactions(payload, user, {
        dry_run: true,
        transactions: [{ title: 'Tea', amount: 30, date: '2026-11-07 16:00', type: 'expense', category: food.name, account: 'Federal' }],
      })
      expect(dry.results[0].status).toBe('would_create')
      expect((await payload.count({ collection: 'transactions', where: { and: [{ user: { equals: user.id } }, { title: { equals: 'Tea' } }] } })).totalDocs).toBe(0)

      const again = await addTransactions(payload, user, {
        transactions: [{ title: 'Lunch', amount: 250, date: '2026-11-07 13:20', type: 'expense', category: food.name, account: 'Federal' }],
      })
      expect(again.results[0].status).toBe('duplicate')
      expect(again.results[0].duplicate_of).toBeTruthy()
      const forced = await addTransactions(payload, user, {
        transactions: [{ title: 'Lunch', amount: 250, date: '2026-11-07 13:20', type: 'expense', category: food.name, account: 'Federal', allow_duplicate: true }],
      })
      expect(forced.results[0].status).toBe('created')
    })

    it('updates by id with names and local time; deletes by id', async () => {
      const [{ id }] = (
        await addTransactions(payload, user, {
          transactions: [{ title: 'Snacks', amount: 99, date: '2026-11-06 18:00', type: 'expense', category: food.name, account: 'Federal' }],
        })
      ).results as { id: string }[]
      const up = await updateTransactions(payload, user, { transactions: [{ id, amount: 120, category: sibling.name, date: '2026-11-06 19:30' }] })
      expect(up.results[0].status).toBe('updated')
      const t = await payload.findByID({ collection: 'transactions', id, depth: 0 })
      expect([Number(t.amount), String(t.category), new Date(t.date).toISOString()]).toEqual([120, sibling.id, '2026-11-06T14:00:00.000Z'])

      const del = await deleteTransactions(payload, user, { ids: [id, '00000000-0000-4000-8000-000000000000'] })
      expect(del.results.map((x) => x.status)).toEqual(['deleted', 'error'])
    })
  })

  describe('search', () => {
    it('finds by category name and local date range, with totals and local times', async () => {
      const res = await searchTransactions(payload, user, { query: food.name, date_from: '2026-11-07', date_to: '2026-11-07' })
      expect(res.totals?.count).toBe(2) // the two Lunch entries
      expect(res.totals?.spent).toBe(500)
      expect(res.transactions[0].date).toMatch(/^2026-11-07 13:\d\d \(\+05:30\)$/)
      expect(res.transactions[0].category).toContain(food.name)
    })

    it('amount and type filters', async () => {
      const res = await searchTransactions(payload, user, { type: 'income', amount_min: 1000 })
      expect(res.transactions.map((t) => t.title)).toEqual(['Salary'])
    })
  })

  describe('sms queue, balances, overview', () => {
    const pendingSms = async (amount: string, n: number) => {
      const acct = (await payload.find({ collection: 'accounts', where: { user: { equals: user.id } }, limit: 1 })).docs[0]
      const doc = await payload.create({
        collection: 'captured-sms',
        data: {
          user: user.id,
          sender: 'AX-FEDBNK-T',
          body: `Debited Rs ${amount} via UPI to SHOP ${stamp}-${n}`,
          hash: `mcp-${stamp}-${n}`,
          receivedAt: '2026-11-05T06:00:00.000Z',
          status: 'pending',
          account: acct.id,
          merchantKey: `SHOP ${stamp}-${n}`,
          parsed: { amount, type: 'expense', merchant: `SHOP ${stamp}-${n}`, ref: `77${stamp}${n}`.slice(0, 12), occurredAt: '2026-11-05T06:00:00.000Z', kind: 'upi_debit', provider: 'federal' },
          suggestion: { title: 'Shop', type: 'expense', category: null, tags: [], person: null, toAccount: null, from: 'default' },
        } as any,
      })
      return String(doc.id)
    }

    it('lists pending SMS in local time and confirms one with names', async () => {
      const id = await pendingSms('321.00', 1)
      const list = await smsQueue(payload, user, { action: 'list' })
      const item = (list as any).sms.find((x: any) => x.id === id)
      expect(item.when).toBe('2026-11-05 11:30 (+05:30)')
      const res = await smsQueue(payload, user, { action: 'confirm', id, category: food.name, title: 'Groceries' })
      expect(res).toMatchObject({ status: 'confirmed' })
      const tx = await payload.findByID({ collection: 'transactions', id: (res as any).transaction, depth: 0 })
      expect([tx.title, String(tx.category)]).toEqual(['Groceries', food.id])
    })

    it('splits an SMS by names, and reports bad names without saving', async () => {
      const id = await pendingSms('500.00', 2)
      const bad = await smsQueue(payload, user, { action: 'split', id, parts: [{ amount: 300, category: 'zzzz-none' }, { amount: 200, category: food.name }] })
      expect(bad).toMatchObject({ status: 'error' })
      const ok = await smsQueue(payload, user, { action: 'split', id, parts: [{ title: 'A', amount: 300, category: food.name }, { title: 'B', amount: 200, category: sibling.name }] })
      expect(ok).toMatchObject({ status: 'confirmed', parts: 2 })
    })

    it('balances and overview answer', async () => {
      const b = await getBalances(payload, user)
      expect(b.accounts.length).toBeGreaterThanOrEqual(2)
      const o = await getOverview(payload, user)
      expect(o.now).toMatch(/\(\+05:30\)$/)
      expect(Array.isArray(o.insights)).toBe(true)
    })
  })

  describe('registered tools', () => {
    const call = async (name: string, args: Record<string, unknown>) => {
      const tool = pikaTools.find((t) => t.name === name)!
      const res = await tool.handler(args, { payload, user } as any)
      return JSON.parse(res.content[0].text)
    }

    it('exposes the task tools', () => {
      expect(pikaTools.map((t) => t.name)).toEqual([
        'get_context', 'add_transactions', 'update_transactions', 'delete_transactions', 'search_transactions',
        'get_overview', 'get_balances', 'sms_queue', 'split_transaction',
      ])
    })

    it('get_context answers with local now and names; errors come back as {error}', async () => {
      const ctx = await call('get_context', {})
      expect(ctx.now).toMatch(/\(\+05:30\)$/)
      expect(ctx.categories.expense.length).toBeGreaterThan(0)
      const bad = await call('sms_queue', { action: 'confirm' })
      expect(bad.error).toMatch(/id is required/)
      const anon = JSON.parse((await pikaTools[0].handler({}, { payload } as any)).content[0].text)
      expect(anon.error).toBe('Unauthorized')
    })
  })
})
