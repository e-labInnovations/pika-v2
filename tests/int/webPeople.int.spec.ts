// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { personSummary } = await import('@/lib/web/people')

describe('web people', () => {
  let payload: Payload
  let me: User
  let other: User
  let mine = ''
  let theirs = ''
  const stamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webp-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User
    me = await mk('me')
    other = await mk('other')
    mine = String((await payload.create({ collection: 'people', data: { name: 'Mine' } as any, user: me, overrideAccess: false })).id)
    theirs = String((await payload.create({ collection: 'people', data: { name: 'Theirs' } as any, user: other, overrideAccess: false })).id)
  })

  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      for (const c of ['people', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it("returns the user's own person with a balance", async () => {
    const s = await personSummary(payload, me, mine)
    expect(s?.person.name).toBe('Mine')
    expect(s?.balance.balance).toBe(0)
  })

  it("returns null for someone else's person (no balance leak)", async () => {
    expect(await personSummary(payload, me, theirs)).toBeNull()
    expect(await personSummary(payload, me, 'not-an-id')).toBeNull()
  })
})
