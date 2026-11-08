import type { Payload, Where } from 'payload'

const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

/**
 * Ids of the user's archived (isActive = false) categories, tags, people and
 * accounts. A category under an archived parent counts as archived too.
 *
 * Archived means "don't offer it any more": suggestions, pickers and the AI prompt
 * skip these ids. Reports and search still count them.
 */
export async function archivedIds(payload: Payload, userId: string): Promise<Set<string>> {
  const base = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true }
  const off: Where = { and: [{ user: { equals: userId } }, { isActive: { equals: false } }] }
  const [cats, tags, people, accounts] = await Promise.all([
    payload.find({ collection: 'categories', where: off, select: { name: true }, ...base }),
    payload.find({ collection: 'tags', where: off, select: { name: true }, ...base }),
    payload.find({ collection: 'people', where: off, select: { name: true }, ...base }),
    payload.find({ collection: 'accounts', where: off, select: { name: true }, ...base }),
  ])
  const ids = new Set<string>([...cats.docs, ...tags.docs, ...people.docs, ...accounts.docs].map((d) => String(d.id)))
  const parents = cats.docs.map((d) => String(d.id))
  if (parents.length) {
    const kids = await payload.find({ collection: 'categories', where: { parent: { in: parents } }, select: { parent: true }, ...base })
    for (const k of kids.docs) if (idOf(k.parent)) ids.add(String(k.id))
  }
  return ids
}

/** Categories with archived parents removed (the query already skipped archived ones). */
export function withoutOrphans<T extends { id: string | number; parent?: unknown }>(cats: T[]): T[] {
  const present = new Set(cats.map((c) => String(c.id)))
  return cats.filter((c) => {
    const p = idOf(c.parent)
    return !p || present.has(p)
  })
}
