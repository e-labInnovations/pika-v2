import type { Access } from 'payload'

export const isNotSystem: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role !== 'system'
}
