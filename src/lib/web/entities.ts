import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { loadLookups } from './transactions'

export type EntityKind = 'tags' | 'people' | 'accounts' | 'categories'

/** What the web forms may set, per collection; anything else in the input is ignored. */
const FIELDS: Record<EntityKind, string[]> = {
  tags: ['name', 'icon', 'color', 'bgColor', 'description'],
  people: ['name', 'email', 'phone', 'description'],
  accounts: ['name', 'icon', 'color', 'bgColor', 'description', 'smsIdentifiers'],
  categories: ['name', 'type', 'parent', 'icon', 'color', 'bgColor', 'description'],
}

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/** The user's own record of this kind, or null (also for shared system ones and, for an admin, other users'). */
async function own(payload: Payload, user: User, kind: EntityKind, id: string) {
  const doc = await payload.findByID({ collection: kind, id, depth: 0, user, overrideAccess: false }).catch(() => null)
  return doc && idOf((doc as { user?: unknown }).user) === String(user.id) ? doc : null
}

/** Creates (id null) or updates the user's own category / tag / person / account. */
export async function saveEntity(payload: Payload, user: User, kind: EntityKind, id: string | null, input: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  const data: Record<string, unknown> = {}
  for (const k of FIELDS[kind]) if (input[k] !== undefined) data[k] = typeof input[k] === 'string' ? (input[k] as string).trim() : input[k]
  if (id === null && !String(data.name ?? '')) return { error: 'Name is required.' }
  if (id !== null && data.name !== undefined && !String(data.name)) return { error: 'Name is required.' }

  let existing: Record<string, unknown> | null = null
  if (id !== null) {
    existing = (await own(payload, user, kind, id)) as Record<string, unknown> | null
    if (!existing) return { error: 'Not found, or a shared item you can’t change.' }
  }

  if (kind === 'categories') {
    // The type is fixed once created; a subcategory's parent must be a top-level one of that type.
    const type = (existing?.type as string) ?? data.type
    if (!['expense', 'income', 'transfer'].includes(String(type))) return { error: 'Choose expense, income or transfer.' }
    if (existing) delete data.type
    if (data.parent !== undefined) {
      if (data.parent) {
        const l = await loadLookups(payload, user)
        const p = l.categories.find((c) => c.id === data.parent)
        if (!p || p.parentId || p.type !== type || p.id === id) return { error: `Choose a top-level ${type} category as the parent.` }
      } else data.parent = null
    }
  }

  try {
    if (id === null) {
      const doc = await payload.create({ collection: kind, data: data as never, user, overrideAccess: false, depth: 0 })
      return { id: String(doc.id) }
    }
    await payload.update({ collection: kind, id, data: data as never, user, overrideAccess: false, depth: 0 })
    return { id }
  } catch (e) {
    return { error: message(e, 'Could not save.') }
  }
}

export async function setArchived(payload: Payload, user: User, kind: EntityKind, id: string, archived: boolean): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, kind, id))) return { error: 'Not found, or a shared item you can’t change.' }
  try {
    await payload.update({ collection: kind, id, data: { isActive: !archived } as never, user, overrideAccess: false, depth: 0 })
    return { ok: true }
  } catch (e) {
    return { error: message(e, 'Could not update.') }
  }
}

export async function deleteEntity(payload: Payload, user: User, kind: EntityKind, id: string): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, kind, id))) return { error: 'Not found, or a shared item you can’t change.' }
  try {
    await payload.delete({ collection: kind, id, user, overrideAccess: false, depth: 0 })
    return { ok: true }
  } catch (e) {
    return { error: message(e, 'Could not delete. Archive it instead if transactions use it.') }
  }
}
