import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'
import { sql } from '@payloadcms/db-postgres'
import { up as backfill } from '@/migrations/20261108_000002_add_transaction_amount_value'

// `amount` is text; `amountValue` is its number, so the server can filter and sort by
// amount (as text "900" sorts after "7000").
describe('transaction amountValue', () => {
  let payload: Payload
  let user: User
  let account: string
  let cat: string
  const stamp = Date.now()
  const tx = (title: string, amount: string) =>
    payload.create({
      collection: 'transactions',
      user,
      overrideAccess: false,
      data: { title, amount, date: '2026-11-01T05:00:00.000Z', type: 'expense', account, category: cat } as any,
    })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `amount-${stamp}@example.com`, password: 'x-Test-12345', name: 'Amount' } as any,
    })) as User
    account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Cash' } as any })).id)
    cat = String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0].id)
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('is set from amount on create and kept in step on update', async () => {
    const t = await tx('Coffee', '45.50')
    expect(t.amountValue).toBe(45.5)
    const u = await payload.update({ collection: 'transactions', id: t.id, user, overrideAccess: false, data: { amount: '120' } as any })
    expect(u.amountValue).toBe(120)
    const v = await payload.update({ collection: 'transactions', id: t.id, user, overrideAccess: false, data: { title: 'Tea' } as any })
    expect(v.amountValue).toBe(120)
  })

  it('filters a range and sorts as numbers', async () => {
    await tx('Small', '900')
    await tx('Big', '7000')
    await tx('Mid', '2500.75')
    const mine = { user: { equals: user.id } }

    const range = await payload.find({
      collection: 'transactions',
      where: { and: [mine, { amountValue: { greater_than_equal: 1000 } }, { amountValue: { less_than_equal: 5000 } }] },
      depth: 0,
    })
    expect(range.docs.map((d) => d.title)).toEqual(['Mid'])

    const sorted = await payload.find({ collection: 'transactions', where: mine, sort: '-amountValue', depth: 0 })
    expect(sorted.docs.map((d) => d.title)).toEqual(['Big', 'Mid', 'Small', 'Tea'])
  })

  it('the migration fills rows saved before the field existed', async () => {
    const t = await tx('Old', '333.33')
    const db = (payload.db as any).drizzle
    await db.execute(sql`UPDATE "transactions" SET "amount_value" = NULL WHERE "id" = ${t.id}`)
    expect((await payload.findByID({ collection: 'transactions', id: t.id, depth: 0 })).amountValue ?? null).toBeNull()
    await backfill({ db, payload } as any)
    expect((await payload.findByID({ collection: 'transactions', id: t.id, depth: 0 })).amountValue).toBe(333.33)
  })
})
