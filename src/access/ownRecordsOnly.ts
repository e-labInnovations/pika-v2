import type { Access } from 'payload'

export const ownRecordsOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  return { user: { equals: user.id } }
}