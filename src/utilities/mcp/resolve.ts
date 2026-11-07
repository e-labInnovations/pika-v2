import type { CategoryRow, Ctx, Named } from './context'

export type Resolved = { id: string } | { error: string }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const list = (xs: Named[]) =>
  xs
    .slice(0, 8)
    .map((x) => `"${x.name}" (${x.id})`)
    .join(', ')

/** Exact name (case-insensitive) → id → a unique partial match; otherwise an error with candidates. */
function pick<T extends Named>(items: T[], value: string, what: string, plural: string): Resolved {
  const v = norm(String(value ?? ''))
  if (!v) return { error: `Empty ${what}.` }
  const exact = items.filter((x) => norm(x.name) === v)
  if (exact.length === 1) return { id: exact[0].id }
  const byId = items.find((x) => x.id === String(value).trim())
  if (byId) return { id: byId.id }
  if (exact.length > 1) return { error: `${exact.length} ${plural} are named "${value}": ${list(exact)}. Use the id.` }
  const partial = items.filter((x) => norm(x.name).includes(v))
  if (partial.length === 1) return { id: partial[0].id }
  if (partial.length > 1) return { error: `${partial.length} ${plural} match "${value}": ${list(partial)}. Use the exact name or id.` }
  return { error: `No ${what} "${value}". Call get_context for the list.` }
}

export function makeResolver(ctx: Ctx) {
  return {
    account: (v: string) => pick(ctx.accounts, v, 'account', 'accounts'),
    person: (v: string) => pick(ctx.people, v, 'person', 'people'),
    tag: (v: string) => pick(ctx.tags, v, 'tag', 'tags'),
    /** A child category of `type`; accepts "Parent > Child". */
    category(v: string, type: CategoryRow['type']): Resolved {
      const raw = String(v ?? '')
      const ofType = ctx.categories.filter((c) => c.type === type)
      const [parent, child] = raw.includes('>') ? raw.split('>').map((x) => x.trim()) : [null, raw]
      const pool = parent ? ofType.filter((c) => norm(c.parent ?? '') === norm(parent)) : ofType
      const r = pick(pool, child, `${type} category`, `${type} categories`)
      if ('id' in r) return r
      // Say so when the name exists but for another type (e.g. an income category on an expense).
      const other = ctx.categories.find((c) => c.type !== type && (norm(c.name) === norm(child) || c.id === raw.trim()))
      if (other) return { error: `"${other.name}" is an ${other.type} category; this transaction is ${type}.` }
      return r
    },
  }
}
