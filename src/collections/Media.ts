import type { CollectionConfig } from 'payload'
import { isAuthenticated } from '../access/isAuthenticated'
import { ownRecordsOnly } from '../access/ownRecordsOnly'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: isAuthenticated,
    read: ownRecordsOnly,
    update: ownRecordsOnly,
    delete: ownRecordsOnly,
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
