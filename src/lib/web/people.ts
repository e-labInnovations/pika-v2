import type { Payload } from 'payload'

import type { Person, User } from '@/payload-types'
import { calculatePersonBalance, type PersonBalanceResult } from '@/utilities/calculatePersonBalance'

/**
 * The user's own person and their balance, or null. The balance helper runs without
 * access control, so ownership is checked first.
 */
export async function personSummary(payload: Payload, user: User, id: string): Promise<{ person: Person; balance: PersonBalanceResult } | null> {
  const person = await payload.findByID({ collection: 'people', id, depth: 1, user, overrideAccess: false }).catch(() => null)
  if (!person) return null
  return { person: person as Person, balance: await calculatePersonBalance(payload, String(person.id)) }
}
