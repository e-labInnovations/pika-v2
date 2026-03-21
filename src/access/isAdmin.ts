import type { Access, FieldAccess } from 'payload'
import { resolveUser } from './isUser'

export const isAdmin: Access = ({ req: { user } }) => {
  return resolveUser(user)?.role === 'admin'
}

export const isAdminField: FieldAccess = ({ req: { user } }) => {
  return resolveUser(user)?.role === 'admin'
}
