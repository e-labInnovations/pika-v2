import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const UserSettings: CollectionConfig = {
  slug: 'user-settings',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'currency', 'theme'],
  },
  access: {
    create: isNotSystem,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'USD',
    },
    {
      name: 'locale',
      type: 'text',
      defaultValue: 'en',
    },
    {
      name: 'theme',
      type: 'select',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'System', value: 'system' },
      ],
      defaultValue: 'system',
    },
    {
      name: 'defaultAccount',
      type: 'relationship',
      relationTo: 'accounts',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      // Flexible key-value store for any additional settings
      name: 'settings',
      type: 'json',
    },
  ],
}
