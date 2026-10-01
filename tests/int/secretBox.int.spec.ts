import { getPayload, Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { decryptSecret, encryptSecret, isEncrypted } from '@/utilities/secretBox'
import { up as encryptMigration } from '@/migrations/20261001_000000_encrypt_api_keys'

describe('secretBox', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptSecret('AIzaSy-test-key-123456')
    const b = encryptSecret('AIzaSy-test-key-123456')
    expect(isEncrypted(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('AIzaSy-test-key-123456')
  })

  it('passes legacy plaintext through and never double-encrypts', () => {
    expect(decryptSecret('plain-key')).toBe('plain-key')
    const once = encryptSecret('k-1234567890')
    expect(encryptSecret(once)).toBe(once)
  })

  it('rejects a tampered value', () => {
    const enc = encryptSecret('k-1234567890')
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'BB' : 'AA')
    expect(() => decryptSecret(tampered)).toThrow()
  })
})

describe('user-settings API keys at rest', () => {
  let payload: Payload
  let userId: string
  let settingsId: string
  const KEY = 'AIzaSy-int-test-0123456789'

  const rawKey = async () => {
    const { rows } = await payload.db.drizzle.execute(
      sql`SELECT gemini_api_key AS v FROM user_settings WHERE id = ${settingsId}`,
    )
    return (rows[0] as { v: string }).v
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const user = await payload.create({
      collection: 'users',
      data: { email: `secretbox-${Date.now()}@example.com`, password: 'x-Test-12345', name: 'Secret Box Test' } as any,
    })
    userId = String(user.id)
    const existing = await payload.find({ collection: 'user-settings', where: { user: { equals: userId } }, depth: 0 })
    settingsId = existing.docs[0]
      ? String(existing.docs[0].id)
      : String((await payload.create({ collection: 'user-settings', data: { user: userId } as any })).id)
  })

  afterAll(async () => {
    if (settingsId) await payload.delete({ collection: 'user-settings', id: settingsId })
    if (userId) await payload.delete({ collection: 'users', id: userId })
  })

  it('stores ciphertext, reads plaintext internally and masked otherwise', async () => {
    const updated = await payload.update({ collection: 'user-settings', id: settingsId, data: { geminiApiKey: KEY } })
    expect(updated.geminiApiKey).toBe('AIzaSy****6789')

    const raw = await rawKey()
    expect(isEncrypted(raw)).toBe(true)
    expect(raw).not.toContain(KEY)

    const internal = await payload.findByID({ collection: 'user-settings', id: settingsId, context: { internal: true } })
    expect(internal.geminiApiKey).toBe(KEY)
  })

  it('saving the masked value back keeps the stored key', async () => {
    await payload.update({ collection: 'user-settings', id: settingsId, data: { geminiApiKey: 'AIzaSy****6789', theme: 'dark' } })
    const internal = await payload.findByID({ collection: 'user-settings', id: settingsId, context: { internal: true } })
    expect(internal.geminiApiKey).toBe(KEY)
    expect(isEncrypted(await rawKey())).toBe(true)
  })

  it('the migration encrypts legacy plaintext and is safe to re-run', async () => {
    await payload.db.drizzle.execute(sql`UPDATE user_settings SET gemini_api_key = ${KEY} WHERE id = ${settingsId}`)
    expect(await rawKey()).toBe(KEY)

    await encryptMigration({ db: payload.db.drizzle } as any)
    const first = await rawKey()
    expect(isEncrypted(first)).toBe(true)

    await encryptMigration({ db: payload.db.drizzle } as any)
    expect(await rawKey()).toBe(first)

    const internal = await payload.findByID({ collection: 'user-settings', id: settingsId, context: { internal: true } })
    expect(internal.geminiApiKey).toBe(KEY)
  })
})
