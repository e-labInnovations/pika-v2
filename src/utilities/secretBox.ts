import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto'
import type { FieldHook } from 'payload'

/**
 * Encryption at rest for secrets stored in the database (users' and the app's AI API
 * keys). AES-256-GCM with a key derived from PAYLOAD_SECRET, so a database dump or a
 * read-only analytics copy no longer exposes working keys.
 *
 * Stored format: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url parts). Values without the
 * prefix are legacy plaintext and are returned unchanged, so rows written before the
 * encryption migration keep working.
 *
 * Changing PAYLOAD_SECRET makes stored keys unreadable: users would have to enter
 * their keys again.
 */
const PREFIX = 'enc:v1:'

let cachedKey: Buffer | null = null
function key(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is not set')
  cachedKey = Buffer.from(hkdfSync('sha256', secret, 'pika', 'secret-box:v1', 32))
  return cachedKey
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(plain: string): string {
  if (isEncrypted(plain)) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv, tag, ct].map((b) => b.toString('base64url')).join(':')
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value
  const [iv, tag, ct] = value.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/**
 * Field hooks for a text field holding a secret. `beforeChange` runs after the
 * collection's beforeChange hooks, which swap a masked value back to the stored one,
 * so what reaches it is always the real key. `afterRead` runs before the collection's
 * afterRead masking, so internal readers (`context.internal`) get plaintext.
 */
export const encryptedFieldHooks: { beforeChange: FieldHook[]; afterRead: FieldHook[] } = {
  beforeChange: [({ value }) => (typeof value === 'string' && value ? encryptSecret(value) : value)],
  afterRead: [
    ({ value }) => {
      if (!isEncrypted(value)) return value
      try {
        return decryptSecret(value)
      } catch {
        // Wrong PAYLOAD_SECRET or a corrupted value: treat as no key rather than
        // failing the whole read.
        return null
      }
    },
  ],
}
