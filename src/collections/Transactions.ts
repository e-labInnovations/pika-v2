import type { CollectionConfig, Where } from 'payload'
import type { User } from '../payload-types'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'amount', 'type', 'date', 'account', 'user'],
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
      name: 'aiAssistant',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/AITransactionPanel#AITransactionPanel',
        },
      },
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
        if (!/^\d+(\.\d{1,4})?$/.test(value))
          return 'Amount must be a positive number with up to 4 decimal places'
        return true
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeFormat: 'HH:mm',
          timeIntervals: 15,
          displayFormat: 'MMM d, yyyy HH:mm',
        },
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
      required: true,
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
      filterOptions: async ({ user, req, data }) => {
        if (!user) return true
        const u = user as User
        if (u.role === 'admin') return data?.type ? { type: { equals: data.type } } : true
        const found = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        const sysIds = found.docs.map((u) => u.id)
        const ownerFilter = { or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])] }
        if (!data?.type) return ownerFilter
        return { and: [ownerFilter, { type: { equals: data.type } }] } as Where
      },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      filterOptions: ({ user, data }) => {
        if (!user) return false
        if (data?.toAccount) return { and: [{ user: { equals: user.id } }, { id: { not_equals: data.toAccount } }] } as Where
        return { user: { equals: user.id } } as Where
      },
      admin: {
        components: {
          Field: '@/components/admin/AccountPickerField#AccountPickerField',
        },
      },
    },
    {
      name: 'toAccount',
      type: 'relationship',
      relationTo: 'accounts',
      filterOptions: ({ user, data }) => {
        if (!user) return false
        if (data?.account) return { and: [{ user: { equals: user.id } }, { id: { not_equals: data.account } }] } as Where
        return { user: { equals: user.id } } as Where
      },
      admin: {
        condition: (data) => data?.type === 'transfer',
        description: 'Destination account for transfers',
        components: {
          Field: '@/components/admin/AccountPickerField#AccountPickerField',
        },
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
      admin: {
        condition: (data) => data?.type !== 'transfer',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        components: {
          Field: '@/components/admin/TagPickerField#TagPickerField',
        },
      },
      filterOptions: async ({ user, req }) => {
        if (!user) return true
        const u = user as User
        if (u.role === 'admin') return true
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
