import { randomBytes } from 'crypto'
import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export type McpKeyRow = { id: string; label: string; enabled: boolean; createdAt: string }

const COLLECTION = 'payload-mcp-api-keys' as const
const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

async function own(payload: Payload, user: User, id: string) {
  const doc = await payload.findByID({ collection: COLLECTION, id, depth: 0, user, overrideAccess: false }).catch(() => null)
  return doc && idOf(doc.user) === String(user.id) ? doc : null
}

/** The user's MCP keys, newest first, without the key values. */
export async function listMcpKeys(payload: Payload, user: User): Promise<McpKeyRow[]> {
  const res = await payload.find({ collection: COLLECTION, where: { user: { equals: user.id } }, sort: '-createdAt', limit: 50, depth: 0, user, overrideAccess: false })
  return res.docs.map((d) => ({ id: String(d.id), label: d.label || 'Untitled key', enabled: d.enableAPIKey !== false, createdAt: d.createdAt }))
}

/** A new key with the plugin's default permissions; the key is returned this once. */
export async function createMcpKey(payload: Payload, user: User, label: string): Promise<{ id: string; apiKey: string } | { error: string }> {
  const name = label.trim().slice(0, 80)
  if (!name) return { error: 'Give the key a name, like "ChatGPT".' }
  const apiKey = randomBytes(24).toString('hex')
  try {
    const doc = await payload.create({ collection: COLLECTION, data: { user: user.id, label: name, enableAPIKey: true, apiKey } as never, user, overrideAccess: false, depth: 0 })
    return { id: String(doc.id), apiKey }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the key.' }
  }
}

export async function setMcpKeyEnabled(payload: Payload, user: User, id: string, enabled: boolean): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, id))) return { error: 'Key not found.' }
  await payload.update({ collection: COLLECTION, id, data: { enableAPIKey: enabled } as never, user, overrideAccess: false, depth: 0 })
  return { ok: true }
}

export async function deleteMcpKey(payload: Payload, user: User, id: string): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, id))) return { error: 'Key not found.' }
  await payload.delete({ collection: COLLECTION, id, user, overrideAccess: false, depth: 0 })
  return { ok: true }
}
