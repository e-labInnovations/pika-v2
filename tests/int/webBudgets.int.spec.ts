// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { saveBudget, deleteBudget } = await import('@/lib/web/budgetsEdit')

describe('web budgets', () => {
  let payload: Payload
  let me: User
  let other: User
  let expenseCat = ''
  let incomeCat = ''
  const stamp = Date.now()
  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webb-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
    const find = async (type: string) => String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: type } }, { parent: { exists: false } }] }, limit: 1, user: me, overrideAccess: false })).docs[0].id)
    expenseCat = await find('expense')
    incomeCat = await find('income')
  })
  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      for (const c of ['budgets', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('creates, updates and deletes a budget on an expense category', async () => {
    const made = await saveBudget(payload, me, null, { category: expenseCat, amount: 5000 })
    expect(made).toHaveProperty('id')
    const id = (made as { id: string }).id
    expect(await saveBudget(payload, me, id, { category: expenseCat, amount: 6000 })).toEqual({ id })
    expect((await payload.findByID({ collection: 'budgets', id })).amount).toBe(6000)
    expect(await saveBudget(payload, me, null, { category: expenseCat, amount: 100 })).toHaveProperty('error') // one per category
    expect(await deleteBudget(payload, me, id)).toEqual({ ok: true })
  })

  it('rejects income categories, bad amounts and other users’ budgets', async () => {
    expect(await saveBudget(payload, me, null, { category: incomeCat, amount: 100 })).toHaveProperty('error')
    expect(await saveBudget(payload, me, null, { category: expenseCat, amount: 0 })).toHaveProperty('error')
    const theirs = (await saveBudget(payload, other, null, { category: expenseCat, amount: 700 })) as { id: string }
    await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
    try {
      const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
      expect(await saveBudget(payload, admin, theirs.id, { category: expenseCat, amount: 1 })).toHaveProperty('error')
      expect(await deleteBudget(payload, admin, theirs.id)).toHaveProperty('error')
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
  })
})
