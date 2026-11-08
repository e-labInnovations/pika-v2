// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { userFromHeaders } = await import('@/lib/session-core')

describe('web session', () => {
  let payload: Payload
  let user: User
  const stamp = Date.now()
  const email = `web-${stamp}@example.com`
  const password = 'x-Test-12345'

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({ collection: 'users', data: { email, password, name: 'Web' } as any })) as User
  })

  afterAll(async () => {
    await payload.delete({ collection: 'user-settings', where: { user: { equals: user.id } } })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('has no user without a token', async () => {
    expect(await userFromHeaders(payload, new Headers())).toBeNull()
  })

  it('has no user for a bad token', async () => {
    expect(await userFromHeaders(payload, new Headers({ cookie: 'payload-token=nope' }))).toBeNull()
  })

  it('reads the user from the payload-token cookie', async () => {
    const { token } = await payload.login({ collection: 'users', data: { email, password } })
    const found = await userFromHeaders(payload, new Headers({ cookie: `payload-token=${token}` }))
    expect(found?.id).toBe(user.id)
  })
})
