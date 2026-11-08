import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/** The signed-in user for these request headers (payload-token cookie or JWT header), or null. */
export async function userFromHeaders(payload: Payload, headers: Headers): Promise<User | null> {
  try {
    const { user } = await payload.auth({ headers })
    return user && user.collection === 'users' ? (user as unknown as User) : null
  } catch {
    return null
  }
}

/** The user's timezone and currency settings (defaults: Asia/Kolkata, INR). */
export async function userPrefs(payload: Payload, userId: string): Promise<{ timeZone: string; currency: string }> {
  const res = await payload.find({ collection: 'user-settings', where: { user: { equals: userId } }, limit: 1, depth: 0, overrideAccess: true })
  const s = res.docs[0] as { timezone?: string | null; currency?: string | null } | undefined
  return { timeZone: !s?.timezone || s.timezone === 'UTC' ? 'Asia/Kolkata' : s.timezone, currency: s?.currency || 'INR' }
}
