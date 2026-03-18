import type { CollectionConfig } from 'payload'
import { isAuthenticated } from '../access/isAuthenticated'
import { ownRecordsOnly } from '../access/ownRecordsOnly'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isActive', 'user'],
  },
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'text',
    },
    {
      name: 'color',
      type: 'text',
    },
    {
      name: 'bgColor',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
