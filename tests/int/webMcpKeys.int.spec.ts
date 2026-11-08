// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { listMcpKeys, createMcpKey, setMcpKeyEnabled, deleteMcpKey } = await import('@/lib/web/mcpKeys')

describe('web MCP keys', () => {
  let payload: Payload
  let me: User
  let other: User
  const stamp = Date.now()
  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webk-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
  })
  afterAll(async () => {
    for (const u of [me, other]) {
      await payload.delete({ collection: 'payload-mcp-api-keys', where: { user: { equals: u.id } } })
      await payload.delete({ collection: 'user-settings', where: { user: { equals: u.id } } })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('creates a key shown once; the list never includes the key', async () => {
    const made = await createMcpKey(payload, me, 'ChatGPT')
    expect(made).toHaveProperty('apiKey')
    const { id, apiKey } = made as { id: string; apiKey: string }
    expect(apiKey.length).toBeGreaterThan(20)
    const list = await listMcpKeys(payload, me)
    expect(list.map((k) => k.id)).toEqual([id])
    expect(JSON.stringify(list)).not.toContain(apiKey)
    expect(list[0]).toMatchObject({ label: 'ChatGPT', enabled: true })
  })

  it('disables and deletes only the user’s own keys (also as admin)', async () => {
    const theirs = (await createMcpKey(payload, other, 'Theirs')) as { id: string }
    const mine = (await listMcpKeys(payload, me))[0]
    expect(await setMcpKeyEnabled(payload, me, mine.id, false)).toEqual({ ok: true })
    expect((await listMcpKeys(payload, me))[0].enabled).toBe(false)
    await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
    try {
      const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
      expect((await listMcpKeys(payload, admin)).some((k) => k.id === theirs.id)).toBe(false)
      expect(await setMcpKeyEnabled(payload, admin, theirs.id, false)).toHaveProperty('error')
      expect(await deleteMcpKey(payload, admin, theirs.id)).toHaveProperty('error')
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
    expect(await deleteMcpKey(payload, me, mine.id)).toEqual({ ok: true })
  })

  it('a key works for MCP auth after create and after disable → enable', async () => {
    const made = (await createMcpKey(payload, me, 'Cycle')) as { id: string; apiKey: string }
    const index = async () => (await payload.findByID({ collection: 'payload-mcp-api-keys', id: made.id, depth: 0, overrideAccess: true, showHiddenFields: true }) as { apiKeyIndex?: string | null }).apiKeyIndex
    expect(await index()).toBeTruthy()
    await setMcpKeyEnabled(payload, me, made.id, false)
    await setMcpKeyEnabled(payload, me, made.id, true)
    expect(await index()).toBeTruthy()
  })

  it('other users can’t read anyone’s keys through access control', async () => {
    const res = await payload.find({ collection: 'payload-mcp-api-keys', where: { user: { equals: me.id } }, user: other, overrideAccess: false, depth: 0 })
    expect(res.docs).toHaveLength(0)
  })
})
