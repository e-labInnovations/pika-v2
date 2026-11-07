import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { searchSummary } = await import('@/utilities/search/searchSummary')
const { calculateInsights } = await import('@/utilities/insights')

const TZ = 'Asia/Calcutta'

describe('search and insights', () => {
  let payload: Payload
  let user: User
  let account: string
  const cats: { id: string; name: string }[] = []
  const stamp = Date.now()
  const tx = (title: string, amount: string, date: string, category: string, type = 'expense') =>
    payload.create({
      collection: 'transactions',
      user,
      overrideAccess: false,
      data: { title, amount, date, type, account, category, note: '' } as any,
    })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `search-${stamp}@example.com`, password: 'x-Test-12345', name: 'Search' } as any,
    })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: TZ } as any })
    account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank' } as any })).id)
    const found = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 4, sort: 'name' })).docs
    for (const c of found) cats.push({ id: String(c.id), name: String(c.name) })
    const income = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'income' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0]

    const [food, gadgets, travel] = cats
    // Three months of history (Aug–Oct 2026), then November.
    for (const m of ['08', '09', '10']) {
      await tx(`Groceries ${m}`, '1000', `2026-${m}-05T06:00:00.000Z`, food.id)
      await tx(`Cable ${m}`, '110', `2026-${m}-06T06:00:00.000Z`, gadgets.id)
      await tx(`Bus pass ${m}`, '3000', `2026-${m}-07T06:00:00.000Z`, travel.id)
    }
    await tx('Groceries big', '2000', '2026-11-04T06:00:00.000Z', food.id)
    await tx('Laptop stand', '5000', '2026-11-08T06:00:00.000Z', gadgets.id)
    await tx('Bus pass 11', '500', '2026-11-09T06:00:00.000Z', travel.id)
    await tx('Salary', '50000', '2026-11-01T06:00:00.000Z', String(income.id), 'income')
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  describe('searchSummary', () => {
    const now = new Date('2026-11-20T06:00:00.000Z')
    const sum = (where: Record<string, unknown>) => searchSummary(payload, String(user.id), where, TZ, now)

    it('totals every transaction the GraphQL-style where matches', async () => {
      // The app turns a typed category name into its id, as here.
      const s = await sum({ OR: [{ title: { contains: 'zzz-nothing' } }, { category: { in: [cats[0].id] } }] })
      expect(s.count).toBe(4)
      expect(s.spent).toBe(5000)
      expect(s.received).toBe(0)
      expect(s.averageSpend).toBe(1250)
    })

    it('a number matches the amount', async () => {
      const s = await sum({ amountValue: { equals: 5000 } })
      expect(s.count).toBe(1)
      expect(s.spent).toBe(5000)
    })

    it('applies AND filters and gives 12 months of spending, oldest first', async () => {
      const s = await sum({ AND: [{ amountValue: { greater_than_equal: 1000 } }] })
      // 1000 ×3, 3000 ×3, 2000, 5000 expenses + salary
      expect(s.count).toBe(9)
      expect(s.received).toBe(50000)
      expect(s.months).toHaveLength(12)
      expect(s.months.at(-1)).toEqual({ month: '2026-11', spent: 7000 })
      expect(s.months.find((m) => m.month === '2026-08')).toEqual({ month: '2026-08', spent: 4000 })
    })

    it('only ever counts the user\'s own transactions, and reads nested paths', async () => {
      const s = await sum({ OR: [{ user: { not_equals: user.id } }, { shares__person: { exists: true } }] })
      expect(s.count).toBe(0)
    })
  })

  describe('calculateInsights', () => {
    it('flags a category above usual, a large expense and the spending pace', async () => {
      const list = await calculateInsights(payload, String(user.id), TZ, new Date('2026-11-20T06:00:00.000Z'))
      const kinds = list.map((i) => i.kind)
      expect(kinds).toContain('category_up')
      expect(kinds).toContain('large')
      const up = list.find((i) => i.kind === 'category_up' && i.filter.categories?.[0] === cats[0].id)!
      expect(up.message).toMatch(/100% above/)
      const large = list.find((i) => i.kind === 'large')!
      expect(large.title).toContain('Laptop stand')
      expect(list.length).toBeLessThanOrEqual(5)
      for (const i of list) {
        expect(i.key).toMatch(/2026-11$/)
        expect(i.filter.dateFrom).toBeTruthy()
      }
    })

    it('a category below usual only late in the month', async () => {
      const early = await calculateInsights(payload, String(user.id), TZ, new Date('2026-11-12T06:00:00.000Z'))
      expect(early.some((i) => i.kind === 'category_down')).toBe(false)
      const late = await calculateInsights(payload, String(user.id), TZ, new Date('2026-11-27T06:00:00.000Z'))
      const down = late.find((i) => i.kind === 'category_down')
      expect(down?.filter.categories).toEqual([cats[2].id])
    })

    it('a first payment to a new payee from SMS', async () => {
      const t = await tx('Fepco Alumin', '20000', '2026-11-10T06:00:00.000Z', cats[3].id)
      await payload.create({
        collection: 'captured-sms',
        data: {
          user: user.id,
          sender: 'AX-FEDBNK-T',
          body: 'x',
          hash: `h-${stamp}`,
          receivedAt: '2026-11-10T06:00:00.000Z',
          status: 'confirmed',
          merchantKey: `FEPCO ${stamp}`,
          transaction: t.id,
          parsed: { amount: '20000.00', merchant: 'FEPCO ALUMIN', type: 'expense' },
        } as any,
      })
      const list = await calculateInsights(payload, String(user.id), TZ, new Date('2026-11-20T06:00:00.000Z'))
      const fresh = list.find((i) => i.kind === 'new_payee')
      expect(fresh?.message).toContain('20,000')
    })

    it('no category insight without two months of history', async () => {
      const list = await calculateInsights(payload, String(user.id), TZ, new Date('2026-09-20T06:00:00.000Z'))
      expect(list.some((i) => i.kind === 'category_up' || i.kind === 'category_down')).toBe(false)
    })
  })
})
