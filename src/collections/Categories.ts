import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { ownOrSystemRecords } from '../access/ownOrSystemRecords'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'parent', 'isActive', 'user'],
  },
  access: {
    create: isNotSystem,
    read: ownOrSystemRecords,
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
      admin: { readOnly: true },
      defaultValue: ({ req }) => {
        return req.user?.id
      },
    },
    {
      name: 'name',
      type: 'text',
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
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      maxDepth: 1,
      filterOptions: async ({ user, req }) => {
        if (!user) return true
        if (user.role === 'admin') return true
        const found = await req.payload.find({ collection: 'users', where: { role: { equals: 'system' } }, limit: 100, depth: 0 })
        const sysIds = found.docs.map((u) => u.id)
        return { or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])] }
      },
      admin: {
        allowEdit: false,
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/IconPickerField#IconPickerField',
        },
      },
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField',
        },
      },
    },
    {
      name: 'bgColor',
      type: 'text',
      label: 'Background Color',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField',
        },
      },
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
