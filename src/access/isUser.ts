import type { User, PayloadMcpApiKey } from '@/payload-types'

export function isUser(user: User | PayloadMcpApiKey | null | undefined): user is User {
  return user != null && 'role' in user
}

/**
 * Resolves the underlying User from either a User or a populated PayloadMcpApiKey.
 * Returns null if the API key's user field is not populated (string ID only).
 */
export function resolveUser(user: User | PayloadMcpApiKey | null | undefined): User | null {
  if (!user) return null
  if (isUser(user)) return user
  // PayloadMcpApiKey.user is string | User depending on depth
  if (typeof user.user === 'object' && user.user !== null && 'role' in user.user) {
    return user.user as User
  }
  return null
}
