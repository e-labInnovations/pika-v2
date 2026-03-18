import type { CollectionConfig } from 'payload'
import { isAuthenticated } from '../access/isAuthenticated'
import { ownRecordsOnly } from '../access/ownRecordsOnly'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'amount', 'type', 'date', 'account', 'user'],
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
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      // Stored as text to preserve decimal precision (e.g. "1234.5600")
      name: 'amount',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'Amount is required'
        if (!/^\d+(\.\d{1,4})?$/.test(value)) return 'Amount must be a positive number with up to 4 decimal places'
        return true
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Income', value: 'income' },
        { label: 'Expense', value: 'expense' },
        { label: 'Transfer', value: 'transfer' },
      ],
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'toAccount',
      type: 'relationship',
      relationTo: 'accounts',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
      admin: {
        condition: (data) => data?.type === 'transfer',
        description: 'Destination account for transfers',
      },
    },
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'note',
      type: 'textarea',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
