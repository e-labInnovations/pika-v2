// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { listPendingSms, confirmOwnSms, dismissOwnSms } = await import('@/lib/web/sms')

describe('web SMS queue', () => {
  let payload: Payload
  let me: User
  let other: User
  let acc = ''
  let cat = ''
  const stamp = Date.now()
  let n = 0

  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `websms-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User
  const sms = async (u: User, account: string, amount = '120.00') =>
    String(
      (
        await payload.create({
          collection: 'captured-sms',
          overrideAccess: true,
          data: {
            user: u.id,
            sender: 'AX-FEDBNK-T',
            body: `Debited Rs ${amount} … ${stamp}-${++n}`,
            receivedAt: '2026-12-09T05:00:00Z',
            hash: `web-${stamp}-${n}`,
            status: 'pending',
            account,
            parsed: { provider: 'federal', kind: 'upi', type: 'expense', amount, occurredAt: '2026-12-09T05:00:00Z', merchant: 'CAFE', ref: `R${stamp}${n}`, accountHints: [], balance: null },
            suggestion: { title: 'Cafe', type: 'expense', category: cat, tags: [], person: null, toAccount: null, from: 'default' },
          } as any,
        })
      ).id,
    )

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
    acc = String((await payload.create({ collection: 'accounts', data: { name: `Fed ${stamp}` } as any, user: me, overrideAccess: false })).id)
    cat = String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1, user: me, overrideAccess: false })).docs[0].id)
  })

  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      await payload.delete({ collection: 'captured-sms', where })
      await payload.delete({ collection: 'transactions', where, trash: true } as any)
      for (const c of ['accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it("lists only the user's pending SMS", async () => {
    const mine = await sms(me, acc)
    const otherAcc = String((await payload.create({ collection: 'accounts', data: { name: `O ${stamp}` } as any, user: other, overrideAccess: false })).id)
    await sms(other, otherAcc)
    const list = await listPendingSms(payload, me)
    expect(list.map((s) => s.id)).toContain(mine)
    expect(list.every((s) => String(typeof s.user === 'object' ? s.user?.id : s.user) === String(me.id))).toBe(true)
  })

  it('confirms with changes into a transaction, and dismisses', async () => {
    const a = await sms(me, acc, '250.00')
    const res = await confirmOwnSms(payload, me, a, { title: 'Coffee with team' })
    expect(res).toHaveProperty('transaction')
    const tx = await payload.findByID({ collection: 'transactions', id: (res as { transaction: string }).transaction, depth: 0 })
    expect(tx.title).toBe('Coffee with team')
    expect(Number(tx.amount)).toBe(250)

    const b = await sms(me, acc, '99.00')
    expect(await dismissOwnSms(payload, me, b)).toEqual({ ok: true })
    expect((await payload.findByID({ collection: 'captured-sms', id: b, depth: 0 })).status).toBe('dismissed')
  })

  it("refuses another user's SMS, even for an admin", async () => {
    const otherAcc = String((await payload.find({ collection: 'accounts', where: { user: { equals: other.id } }, limit: 1 })).docs[0].id)
    const theirs = await sms(other, otherAcc)
    await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
    try {
      const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
      expect(await confirmOwnSms(payload, admin, theirs, {})).toHaveProperty('error')
      expect(await dismissOwnSms(payload, admin, theirs)).toHaveProperty('error')
      expect((await listPendingSms(payload, admin)).some((s) => s.id === theirs)).toBe(false)
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
  })
})
