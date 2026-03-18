import type { CollectionConfig } from 'payload'
import { isAuthenticated } from '../access/isAuthenticated'
import { ownRecordsOnly } from '../access/ownRecordsOnly'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Reminders: CollectionConfig = {
  slug: 'reminders',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'amount', 'type', 'nextDueDate', 'archived', 'user'],
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
      name: 'amount',
      type: 'text',
      validate: (value: string | null | undefined) => {
        if (!value) return true // optional
        if (!/^\d+(\.\d{1,4})?$/.test(value)) return 'Amount must be a positive number with up to 4 decimal places'
        return true
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Income', value: 'income' },
        { label: 'Expense', value: 'expense' },
        { label: 'Transfer', value: 'transfer' },
      ],
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
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'people',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'date',
      type: 'date',
    },
    {
      name: 'isRecurring',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'recurrencePeriod',
      type: 'number',
      admin: {
        condition: (data) => Boolean(data?.isRecurring),
        description: 'How many units between recurrences',
      },
    },
    {
      name: 'recurrenceType',
      type: 'select',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ],
      admin: {
        condition: (data) => Boolean(data?.isRecurring),
      },
    },
    {
      name: 'lastTriggeredAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'nextDueDate',
      type: 'date',
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
      name: 'completedDates',
      type: 'array',
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
