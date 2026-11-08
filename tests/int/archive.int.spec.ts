import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { loadContext, contextForModel } = await import('@/utilities/mcp/context')
const { makeResolver } = await import('@/utilities/mcp/resolve')
const { addTransactions, searchTransactions } = await import('@/utilities/mcp/transactions')
const { getBalances } = await import('@/utilities/mcp/more')
const { archivedIds } = await import('@/utilities/archived')
const { calculateMonthlyTags } = await import('@/utilities/calculateMonthlyTags')
const { calculateMonthlyCategories } = await import('@/utilities/calculateMonthlyCategories')
const { calculateMonthlyPeople } = await import('@/utilities/calculateMonthlyPeople')
const { budgetsOverview } = await import('@/utilities/budgets')

const TZ = 'Asia/Calcutta'

/** Archived = not offered for new entries, still counted in reports and search. */
describe('archived categories, tags, people and accounts', () => {
  let payload: Payload
  let user: User
  const stamp = Date.now()
  const now = new Date()
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now).split('-').map(Number)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
  const ids: Record<string, string> = {}

  const make = async (collection: 'tags' | 'people' | 'accounts' | 'categories', data: Record<string, unknown>) =>
    String((await payload.create({ collection, user, overrideAccess: false, data: data as any })).id)
  const archive = (collection: 'tags' | 'people' | 'accounts' | 'categories', id: string) =>
    payload.update({ collection, id, user, overrideAccess: false, data: { isActive: false } as any })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({ collection: 'users', data: { email: `arch-${stamp}@example.com`, password: 'x-Test-12345', name: 'Arch' } as any })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: TZ } as any })
    ids.account = await make('accounts', { name: `Main ${stamp}` })
    ids.oldAccount = await make('accounts', { name: `OldWallet ${stamp}` })
    ids.trip = await make('tags', { name: `Trip${stamp}`, icon: 'tag' })
    ids.unusedTag = await make('tags', { name: `Unused${stamp}`, icon: 'tag' })
    ids.friend = await make('people', { name: `Friend ${stamp}` })
    ids.parent = await make('categories', { name: `Hobby ${stamp}`, type: 'expense', icon: 'tag' })
    ids.child = await make('categories', { name: `Kites ${stamp}`, type: 'expense', icon: 'tag', parent: ids.parent })

    const res = await addTransactions(payload, user, {
      transactions: [
        { title: 'Houseboat', amount: 4000, date: `${today} 10:00`, type: 'expense', category: `Kites ${stamp}`, account: `Main ${stamp}`, tags: [`Trip${stamp}`], person: `Friend ${stamp}` },
      ],
    })
    expect(res.results[0].status).toBe('created')
    await payload.create({ collection: 'budgets', user, overrideAccess: false, data: { category: ids.parent, amount: '1000' } as any })

    await archive('tags', ids.trip)
    await archive('tags', ids.unusedTag)
    await archive('people', ids.friend)
    await archive('accounts', ids.oldAccount)
    await archive('categories', ids.parent)
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    for (const c of ['budgets', 'tags', 'people', 'accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
    await payload.delete({ collection: 'categories', where: { and: [where, { parent: { exists: true } }] } })
    await payload.delete({ collection: 'categories', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('archivedIds covers each kind, and children of an archived category', async () => {
    const set = await archivedIds(payload, String(user.id))
    for (const k of ['trip', 'unusedTag', 'friend', 'oldAccount', 'parent', 'child']) expect(set.has(ids[k]), k).toBe(true)
    expect(set.has(ids.account)).toBe(false)
  })

  it('reports keep archived items that had activity and drop unused ones', async () => {
    const tags = await calculateMonthlyTags(payload, String(user.id), month, year, TZ)
    expect(tags.data.find((t) => t.id === ids.trip)?.expenseAmount).toBe(4000)
    expect(tags.data.some((t) => t.id === ids.unusedTag)).toBe(false)
    expect(tags.meta.totalExpenses).toBe(4000)

    const cats = await calculateMonthlyCategories(payload, String(user.id), month, year, TZ)
    expect(cats.data.find((c) => c.id === ids.child)?.amount).toBe(4000)
    expect(cats.data.find((c) => c.id === ids.parent)?.amount).toBe(4000)

    const people = await calculateMonthlyPeople(payload, String(user.id), month, year, TZ)
    expect(people.data.some((p) => p.id === ids.friend)).toBe(true)
  })

  it('MCP: the model is not offered archived items; writes name them as archived; search still finds them', async () => {
    const ctx = await loadContext(payload, user)
    const model = contextForModel(ctx)
    expect(model.tags.some((t) => t.id === ids.trip)).toBe(false)
    expect(model.people.some((p) => p.id === ids.friend)).toBe(false)
    expect(model.accounts.some((a) => a.id === ids.oldAccount)).toBe(false)
    expect(JSON.stringify(model.categories)).not.toContain(ids.child)

    const r = makeResolver(ctx)
    expect(r.tag(`Trip${stamp}`)).toMatchObject({ error: expect.stringMatching(/archived/) })
    expect(r.category(`Kites ${stamp}`, 'expense')).toMatchObject({ error: expect.stringMatching(/archived/) })
    expect(r.person(`Friend ${stamp}`)).toMatchObject({ error: expect.stringMatching(/archived/) })

    const add = await addTransactions(payload, user, {
      transactions: [{ title: 'Snack', amount: 50, date: `${today} 11:00`, type: 'expense', category: `Kites ${stamp}`, account: `Main ${stamp}`, tags: [`Trip${stamp}`] }],
    })
    expect(add.results[0].status).toBe('error')
    expect(add.results[0].errors?.join(' ')).toMatch(/archived/)

    const found = await searchTransactions(payload, user, { tags: [`Trip${stamp}`] } as any)
    expect(found.totals?.count ?? (found as any).total).toBeTruthy()
    expect(JSON.stringify(found)).toContain('Houseboat')
  })

  it('balances list an archived account only while money is left in it', async () => {
    const b = await getBalances(payload, user)
    expect(b.accounts.some((a) => a.id === ids.oldAccount)).toBe(false)
    expect(b.accounts.some((a) => a.id === ids.account)).toBe(true)
  })

  it('a budget on an archived category is flagged', async () => {
    const list = await budgetsOverview(payload, String(user.id), TZ)
    expect(list).toHaveLength(1)
    expect(list[0].archived).toBe(true)
  })
})
