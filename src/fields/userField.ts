import type { RelationshipField } from 'payload'
import { isAdminField } from '@/access/isAdmin'

export const userField: RelationshipField = {
  name: 'user',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  defaultValue: ({ req }) => req.user?.id,
  access: {
    update: isAdminField,
  },
}
