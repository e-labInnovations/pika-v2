import type { Payload } from 'payload'
import type { Category } from '@/payload-types'
import { nearestHistory } from './user-history'

/** Below these sizes a list is sent whole; narrowing would save little and risk a miss. */
const KEEP_ALL = { categories: 25, tags: 15, people: 15 }
const FREQUENT = 12

type Doc = { id: string | number; name?: string | null }

export type Relevant = { categories: Set<string>; tags: Set<string>; people: Set<string> }

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

/** Names that appear in the text: the whole name, or any word of it (first names, "fuel"). */
function mentioned(docs: Doc[], text: string): string[] {
  const t = text.toLowerCase()
  const inText = new Set(words(text))
  return docs
    .filter((d) => {
      const name = (d.name ?? '').toLowerCase().trim()
      return (name.length >= 3 && t.includes(name)) || words(name).some((w) => inText.has(w))
    })
    .map((d) => String(d.id))
}

const top = (counts: Map<string, number>, n: number) =>
  [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id)

/**
 * Which categories, tags and people are worth sending to the LLM for this text: those on
 * the most similar past transactions, the user's most used ones lately (latest 1000), and any named in
 * the text or tagged. Null when there is too little history to judge (send everything).
 */
export async function relevantEntities(
  payload: Payload,
  userId: string,
  text: string,
  lists: { categories: Category[]; tags: Doc[]; people: Doc[] },
  taggedIds: string[] = [],
): Promise<Relevant | null> {
  const neighbours = await nearestHistory(payload, userId, text).catch(() => null)
  if (!neighbours) return null

  // Most used lately: the latest transactions, whatever their dates.
  const recent = await payload.find({
    collection: 'transactions',
    where: { user: { equals: userId } },
    sort: '-date',
    limit: 1000,
    depth: 0,
    select: { category: true, tags: true },
  })
  const catCount = new Map<string, number>()
  const tagCount = new Map<string, number>()
  for (const t of recent.docs) {
    if (t.category) catCount.set(String(t.category), (catCount.get(String(t.category)) ?? 0) + 1)
    for (const tag of (t.tags as string[] | null) ?? []) tagCount.set(String(tag), (tagCount.get(String(tag)) ?? 0) + 1)
  }

  const tagged = new Set(taggedIds)
  const children = lists.categories.filter((c) => c.parent)
  return {
    categories: new Set([
      ...neighbours.map((n) => n.categoryId),
      ...top(catCount, FREQUENT),
      ...mentioned(children, text),
      ...children.filter((c) => tagged.has(String(c.id))).map((c) => String(c.id)),
    ]),
    tags: new Set([...neighbours.flatMap((n) => n.tagIds), ...top(tagCount, FREQUENT), ...mentioned(lists.tags, text), ...taggedIds]),
    people: new Set([
      ...neighbours.map((n) => n.personId).filter((p): p is string => !!p),
      ...mentioned(lists.people, text),
      ...taggedIds,
    ]),
  }
}

/** Applies `relevant` to the lists, leaving short lists (and all parent categories) whole. */
export function narrowLists<C extends Category, T extends Doc, P extends Doc>(
  lists: { categories: C[]; tags: T[]; people: P[] },
  relevant: Relevant,
): { categories: C[]; tags: T[]; people: P[] } {
  const keep = <D extends Doc>(docs: D[], ids: Set<string>, min: number) =>
    docs.length <= min ? docs : docs.filter((d) => ids.has(String(d.id)))
  const children = lists.categories.filter((c) => c.parent)
  return {
    categories:
      children.length <= KEEP_ALL.categories
        ? lists.categories
        : lists.categories.filter((c) => !c.parent || relevant.categories.has(String(c.id))),
    tags: keep(lists.tags, relevant.tags, KEEP_ALL.tags),
    people: keep(lists.people, relevant.people, KEEP_ALL.people),
  }
}
