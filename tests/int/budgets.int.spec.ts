import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { budgetsOverview } = await import('@/utilities/budgets')
const { calculateInsights } = await import('@/utilities/insights')

const TZ = 'Asia/Calcutta'

describe('budgets', () => {
  let payload: Payload
  let user: User
  let account: string
  let parent: string
  let child: string
  let other: string
  const stamp = Date.now()
  const tx = (amount: string, date: string, category: string) =>
    payload.create({ collection: 'transactions', user, overrideAccess: false, data: { title: 'x', amount, date, type: 'expense', account, category } as any })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({ collection: 'users', data: { email: `budget-${stamp}@example.com`, password: 'x-Test-12345', name: 'Budget' } as any })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: TZ } as any })
    account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank' } as any })).id)
    const kid = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0]
    child = String(kid.id)
    parent = String(typeof kid.parent === 'object' ? (kid.parent as any).id : kid.parent)
    other = String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }, { parent: { not_equals: parent } }] }, limit: 1 })).docs[0].id)

    await tx('3000', '2026-11-03T06:00:00.000Z', child)
    await tx('4500', '2026-11-15T06:00:00.000Z', child)
    await tx('900', '2026-10-31T19:00:00.000Z', child) // 1 Nov 00:30 IST: November
    await tx('5000', '2026-10-20T06:00:00.000Z', child) // October: not counted
    await tx('100', '2026-11-05T06:00:00.000Z', other)
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'budgets', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('a parent category budget counts its subcategories, this local month only', async () => {
    await payload.create({ collection: 'budgets', user, overrideAccess: false, data: { category: parent, amount: 8000 } as any })
    await payload.create({ collection: 'budgets', user, overrideAccess: false, data: { category: other, amount: 1000 } as any })
    const list = await budgetsOverview(payload, String(user.id), TZ, new Date('2026-11-20T06:00:00.000Z'))
    expect(list.map((b) => [b.category.id, b.spent, b.left, b.percent, b.status])).toEqual([
      [parent, 8400, -400, 105, 'over'],
      [other, 100, 900, 10, 'ok'],
    ])
  })

  it('one budget per category', async () => {
    await expect(
      payload.create({ collection: 'budgets', user, overrideAccess: false, data: { category: other, amount: 50 } as any }),
    ).rejects.toBeTruthy()
  })

  it('a budget at 80% or over shows as an insight', async () => {
    const list = await calculateInsights(payload, String(user.id), TZ, new Date('2026-11-20T06:00:00.000Z'))
    const b = list.find((i) => i.kind === 'budget')
    expect(b?.message).toMatch(/over/)
    expect(b?.filter.categories).toContain(child)
  })
})
