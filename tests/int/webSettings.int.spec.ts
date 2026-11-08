// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { loadSettings, saveSettings } = await import('@/lib/web/settings')

describe('web settings', () => {
  let payload: Payload
  let me: User
  let other: User
  const stamp = Date.now()
  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webs-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
  })
  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      for (const c of ['accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('saves preferences and the profile name', async () => {
    const acc = await payload.create({ collection: 'accounts', data: { name: `A ${stamp}` } as any, user: me, overrideAccess: false })
    expect(await saveSettings(payload, me, { name: 'Ashad', currency: 'INR', timezone: 'Asia/Calcutta', defaultAccount: String(acc.id), smsAutoConfirm: true, smsAutoConfirmMaxAmount: 1500 })).toEqual({ ok: true })
    const s = await loadSettings(payload, me)
    expect(s).toMatchObject({ name: 'Ashad', currency: 'INR', timezone: 'Asia/Calcutta', defaultAccount: String(acc.id), smsAutoConfirm: true, smsAutoConfirmMaxAmount: 1500 })
  })

  it('rejects a bad timezone and someone else’s account', async () => {
    expect(await saveSettings(payload, me, { timezone: 'Mars/Olympus' })).toHaveProperty('error')
    const theirs = await payload.create({ collection: 'accounts', data: { name: `T ${stamp}` } as any, user: other, overrideAccess: false })
    expect(await saveSettings(payload, me, { defaultAccount: String(theirs.id) })).toHaveProperty('error')
  })

  it('stores API keys but never returns them, and can clear them', async () => {
    expect(await saveSettings(payload, me, { geminiApiKey: 'AIza-secret-123' })).toEqual({ ok: true })
    const s = await loadSettings(payload, me)
    expect(s.hasGeminiKey).toBe(true)
    expect(JSON.stringify(s)).not.toContain('AIza-secret-123')
    expect(await saveSettings(payload, me, { geminiApiKey: null })).toEqual({ ok: true })
    expect((await loadSettings(payload, me)).hasGeminiKey).toBe(false)
  })
})
