// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { importOwnRows, parseOwnStatement } = await import('@/lib/web/statements')

describe('web statement import', () => {
  let payload: Payload
  let me: User
  let other: User
  let acc = ''
  let otherAcc = ''
  let cat = ''
  const stamp = Date.now()
  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webst-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
    acc = String((await payload.create({ collection: 'accounts', data: { name: `Fed ${stamp}` } as any, user: me, overrideAccess: false })).id)
    otherAcc = String((await payload.create({ collection: 'accounts', data: { name: `O ${stamp}` } as any, user: other, overrideAccess: false })).id)
    cat = String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1, user: me, overrideAccess: false })).docs[0].id)
  })
  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      await payload.delete({ collection: 'transactions', where, trash: true } as any)
      for (const c of ['accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  const row = { date: '2026-11-03', amount: '420.00', type: 'expense' as const, title: `Statement row ${stamp}`, category: '' }

  it('imports rows into the user’s own account', async () => {
    const res = await importOwnRows(payload, me, acc, [{ ...row, category: cat }])
    expect(res).toHaveProperty('ids')
    expect((res as { ids: string[] }).ids).toHaveLength(1)
  })

  it('refuses another user’s account (also for an admin) and foreign ids', async () => {
    await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
    try {
      const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
      expect(await importOwnRows(payload, admin, otherAcc, [{ ...row, category: cat }])).toHaveProperty('error')
      expect(await parseOwnStatement(payload, admin, { file: 'JVBERi0=', account: otherAcc })).toHaveProperty('error')
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
    expect(await importOwnRows(payload, me, acc, [{ ...row, category: '00000000-0000-4000-8000-000000000000' }])).toHaveProperty('error')
    expect(await importOwnRows(payload, me, acc, [])).toHaveProperty('error')
  })
})
