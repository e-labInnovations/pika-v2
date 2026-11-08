import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { loadLookups } from './transactions'

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

async function own(payload: Payload, user: User, id: string) {
  const doc = await payload.findByID({ collection: 'budgets', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  return doc && idOf(doc.user) === String(user.id) ? doc : null
}

/** Creates (id null) or updates a monthly limit on one of the user's expense categories. */
export async function saveBudget(payload: Payload, user: User, id: string | null, input: { category: string; amount: number }): Promise<{ id: string } | { error: string }> {
  const amount = Math.round(Number(input.amount))
  if (!(amount >= 1)) return { error: 'The limit must be at least 1.' }
  const l = await loadLookups(payload, user)
  const cat = l.categories.find((c) => c.id === input.category)
  if (!cat || cat.type !== 'expense') return { error: 'Choose an expense category.' }
  if (id !== null && !(await own(payload, user, id))) return { error: 'Budget not found.' }
  try {
    if (id === null) {
      const doc = await payload.create({ collection: 'budgets', data: { category: input.category, amount } as never, user, overrideAccess: false, depth: 0 })
      return { id: String(doc.id) }
    }
    await payload.update({ collection: 'budgets', id, data: { category: input.category, amount } as never, user, overrideAccess: false, depth: 0 })
    return { id }
  } catch (e) {
    return { error: message(e, 'Could not save.') }
  }
}

export async function deleteBudget(payload: Payload, user: User, id: string): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, id))) return { error: 'Budget not found.' }
  try {
    await payload.delete({ collection: 'budgets', id, user, overrideAccess: false, depth: 0 })
    return { ok: true }
  } catch (e) {
    return { error: message(e, 'Could not delete.') }
  }
}
