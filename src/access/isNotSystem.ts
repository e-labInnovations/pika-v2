import type { Access } from 'payload'
import { resolveUser } from './isUser'

export const isNotSystem: Access = ({ req: { user } }) => {
  if (!user) return false
  return resolveUser(user)?.role !== 'system'
}
