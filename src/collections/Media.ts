import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Media: CollectionConfig = {
  slug: 'media',
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
      name: 'alt',
      type: 'text',
    },
    {
      name: 'type',
      type: 'select',
      options: ['avatar', 'attachment', 'other'],
      defaultValue: 'other',
    },
    {
      name: 'entityType',
      type: 'select',
      options: ['person', 'account', 'transaction', 'other'],
      defaultValue: 'other',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { readOnly: true },
    },
  ],
  upload: true,
}
