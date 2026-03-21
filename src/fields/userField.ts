import type { RelationshipField } from 'payload'

export const userField: RelationshipField = {
  name: 'user',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  defaultValue: ({ req }) => req.user?.id,
  access: {
    update: ({ req: { user } }) => user?.role === 'admin',
  },
}
