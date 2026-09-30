import type { Payload } from 'payload'
import type { TaggedEntity } from './prompts'

/**
 * Entities the user tagged in an AI prompt, written by the app as `@[Name](type:id)`,
 * e.g. "Rs 45 coffee from @[Federal](account:…) and @[Rony](person:…) 25 split".
 */
const TOKEN = /@\[([^\]\n]{1,80})\]\((person|account|category|tag):([0-9a-fA-F-]{36})\)/g

export function parseTaggedEntities(text: string): TaggedEntity[] {
  const seen = new Set<string>()
  const out: TaggedEntity[] = []
  for (const m of text.matchAll(TOKEN)) {
    const [, name, type, id] = m
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ type: type as TaggedEntity['type'], id, name: name.trim() })
  }
  return out
}

const COLLECTION = { person: 'people', account: 'accounts', category: 'categories', tag: 'tags' } as const

/**
 * Keeps only entities that exist and that the user may use: their own people and
 * accounts, and their own or system (shared) categories and tags. Anything else in the
 * text is treated as plain words, so a forged id cannot reach the transaction.
 */
export async function verifyTaggedEntities(
  payload: Payload,
  userId: string,
  entities: TaggedEntity[],
): Promise<TaggedEntity[]> {
  if (entities.length === 0) return []
  const system = await payload.find({ collection: 'users', where: { role: { equals: 'system' } }, limit: 100, depth: 0 })
  const owners = new Set([userId, ...system.docs.map((u) => String(u.id))])

  const ok = new Set<string>()
  for (const type of Object.keys(COLLECTION) as TaggedEntity['type'][]) {
    const ids = entities.filter((e) => e.type === type).map((e) => e.id)
    if (ids.length === 0) continue
    const found = await payload.find({
      collection: COLLECTION[type],
      where: { id: { in: ids } },
      limit: ids.length,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of found.docs as { id: string; user?: unknown }[]) {
      const owner = typeof d.user === 'object' && d.user ? (d.user as { id: string }).id : d.user
      const allowed = type === 'person' || type === 'account' ? owner === userId : owners.has(String(owner))
      if (allowed) ok.add(`${type}:${d.id}`)
    }
  }
  return entities.filter((e) => ok.has(`${e.type}:${e.id}`))
}

/**
 * Tagged entities override what the model picked: the user named them explicitly.
 * Accounts fill account (then toAccount, for a transfer), a category replaces the
 * category, and tags are added. People are left to the model, which decides whether a
 * tagged person is the payee or a share.
 */
export function applyTaggedEntities(raw: Record<string, unknown>, entities: TaggedEntity[]): Record<string, unknown> {
  const out = { ...raw }
  const of = (t: TaggedEntity['type']) => entities.filter((e) => e.type === t).map((e) => e.id)

  const accounts = of('account')
  if (accounts.length >= 1) out.account = accounts[0]
  if (accounts.length >= 2 && out.type === 'transfer') out.toAccount = accounts[1]

  const categories = of('category')
  if (categories.length >= 1) out.category = categories[0]

  const tags = of('tag')
  if (tags.length) {
    const current = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string' && !!t) : []
    out.tags = [...new Set([...current, ...tags])]
  }
  return out
}

// Whole paisa, so share sums compare exactly
const toPaisa = (v: unknown) => Math.round((parseFloat(String(v ?? '')) || 0) * 100)

/**
 * Cleans the model's shares so saving them never fails validation: known people only
 * (`allowedPersonIds`), one share each, positive amounts, and together no more than the
 * transaction amount — shares that would overflow it are dropped. Amounts become "0.00"
 * strings.
 */
export function normalizeShares(
  shares: unknown,
  amount: unknown,
  allowedPersonIds: ReadonlySet<string>,
): { person: string; amount: string }[] {
  if (!Array.isArray(shares)) return []
  const total = toPaisa(amount)
  const seen = new Set<string>()
  const out: { person: string; amount: string }[] = []
  let used = 0
  for (const s of shares as { person?: unknown; amount?: unknown }[]) {
    const person = typeof s?.person === 'string' ? s.person : ''
    const paisa = toPaisa(s?.amount)
    if (!person || !allowedPersonIds.has(person) || seen.has(person) || paisa <= 0) continue
    if (used + paisa > total) continue
    seen.add(person)
    used += paisa
    out.push({ person, amount: (paisa / 100).toFixed(2) })
  }
  return out
}
