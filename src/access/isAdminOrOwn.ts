import type { Access } from 'payload'
import { resolveUser } from './isUser'

export const isAdminOrOwn: Access = ({ req: { user } }) => {
  if (!user) return false
  const resolved = resolveUser(user)
  if (resolved?.role === 'admin') return true
  return { user: { equals: user.id } }
}
