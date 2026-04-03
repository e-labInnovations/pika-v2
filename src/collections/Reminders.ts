import type { CollectionConfig } from 'payload'
import type { User } from '../payload-types'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields/userField'

export const Reminders: CollectionConfig = {
  slug: 'reminders',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'amount', 'type', 'nextDueDate', 'archived', 'user'],
    group: 'Pika',
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
    userField,
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
        if (!/^\d+(\.\d{1,4})?$/.test(value))
          return 'Amount must be a positive number with up to 4 decimal places'
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
      admin: {
        components: {
          Field: '@/components/admin/CategoryPickerField#CategoryPickerField',
        },
      },
      filterOptions: async ({ user, req }) => {
        if (!user) return true
        if ((user as User).role === 'admin') return true
        const found = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        const sysIds = found.docs.map((u) => u.id)
        return {
          or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])],
        }
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
      filterOptions: async ({ user, req }) => {
        if (!user) return true
        if ((user as User).role === 'admin') return true
        const found = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        const sysIds = found.docs.map((u) => u.id)
        return {
          or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])],
        }
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
