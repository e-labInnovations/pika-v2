import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isUser } from '@/access/isUser'

/**
 * OAuth accounts collection — used exclusively by payload-auth-plugin.
 * Stores the link between a Payload user and their OAuth provider identity.
 * Do not confuse with the `accounts` collection (financial accounts).
 */
export const OAuthAccounts: CollectionConfig = {
  slug: 'oauth-accounts',
  admin: {
    group: 'System',
    useAsTitle: 'id',
    defaultColumns: ['user', 'issuerName', 'sub', 'createdAt'],
    hidden: true, // hide from sidebar — managed by auth plugin
  },
  access: {
    admin: ({ req: { user } }) => isUser(user) && user.role === 'admin',
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'picture',
      type: 'text',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true,
    },
    {
      name: 'issuerName',
      type: 'text',
      required: true,
    },
    {
      name: 'scope',
      type: 'text',
    },
    {
      name: 'sub',
      type: 'text',
      required: true,
    },
    {
      name: 'access_token',
      type: 'text',
    },
  ],
  timestamps: true,
}
