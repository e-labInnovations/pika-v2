import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { formatLocal, zoneOf } from './time'

export type Named = { id: string; name: string }
export type CategoryRow = Named & { type: 'income' | 'expense' | 'transfer'; parent: string | null; parentId: string | null }

/** What the tools resolve names against: the user's records plus system categories/tags. */
export type Ctx = {
  userId: string
  /** The user's timezone setting (a missing one is read as Asia/Kolkata when used). */
  timezone: string
  currency: string
  accounts: Named[]
  /** Child categories (the ones a transaction can use), with their parent's name. */
  categories: CategoryRow[]
  tags: Named[]
  people: Named[]
}

const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

export async function loadContext(payload: Payload, user: User): Promise<Ctx> {
  const as = { user, overrideAccess: false as const, pagination: false as const, depth: 0 }
  const active = { isActive: { not_equals: false } }
  const [settings, accounts, cats, tags, people] = await Promise.all([
    payload.find({ collection: 'user-settings', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'accounts', where: active, ...as }),
    payload.find({ collection: 'categories', where: active, ...as }),
    payload.find({ collection: 'tags', where: active, ...as }),
    payload.find({ collection: 'people', where: active, ...as }),
  ])
  const s = settings.docs[0] as { timezone?: string; currency?: string } | undefined
  const byId = new Map(cats.docs.map((c) => [String(c.id), c]))
  const named = (d: { id: unknown; name?: unknown }) => ({ id: String(d.id), name: String(d.name ?? '') })
  return {
    userId: String(user.id),
    timezone: s?.timezone || 'UTC',
    currency: s?.currency || 'INR',
    accounts: accounts.docs.map(named),
    categories: cats.docs
      .filter((c) => idOf(c.parent))
      .map((c) => {
        const parentId = idOf(c.parent)!
        return { ...named(c), type: c.type as CategoryRow['type'], parentId, parent: String(byId.get(parentId)?.name ?? '') || null }
      }),
    tags: tags.docs.map(named),
    people: people.docs.map(named),
  }
}

/** The context as the model sees it: grouped categories, today's local time. */
export function contextForModel(ctx: Ctx, now = new Date()) {
  const tz = zoneOf(ctx.timezone)
  const group = (type: CategoryRow['type']) => {
    const parents = new Map<string, Named[]>()
    for (const c of ctx.categories.filter((x) => x.type === type)) {
      const key = c.parent ?? '(none)'
      parents.set(key, [...(parents.get(key) ?? []), { id: c.id, name: c.name }])
    }
    return [...parents.entries()].map(([parent, children]) => ({ parent, categories: children }))
  }
  return {
    now: formatLocal(now, tz),
    timezone: tz,
    currency: ctx.currency,
    rules: [
      'Dates are local time: "YYYY-MM-DD" or "YYYY-MM-DD HH:mm". Do not convert to UTC.',
      'Use names (or ids) for account, category, tags and person. Categories accept "Parent > Child".',
      'Amounts are positive numbers. Up to 50 transactions per add/update call.',
    ],
    accounts: ctx.accounts,
    categories: { expense: group('expense'), income: group('income'), transfer: group('transfer') },
    tags: ctx.tags,
    people: ctx.people,
  }
}
