import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields/userField'
import { calculateAccountBalance } from '../utilities/calculateAccountBalance'

export const Accounts: CollectionConfig = {
  slug: 'accounts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isActive', 'user'],
  },
  access: {
    create: isNotSystem,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate],
    afterRead: [
      async ({ doc, req }) => {
        if (!req?.payload || !doc?.id) return doc
        const balanceData = await calculateAccountBalance(req.payload, doc.id)
        return { ...doc, ...balanceData }
      },
    ],
  },
  fields: [
    userField,
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/IconPickerField#IconPickerField'
        }
      },
    },
    {
      name: 'bgColor',
      type: 'text',
      label: 'Background Color',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField'
        }
      },
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField'
        }
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
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
    // Virtual fields — computed in afterRead, never stored in the database
    {
      name: 'balance',
      type: 'number',
      virtual: true,
      admin: { readOnly: true },
    },
    {
      name: 'totalTransactions',
      type: 'number',
      virtual: true,
      admin: { readOnly: true },
    },
    {
      name: 'lastTransactionAt',
      type: 'date',
      virtual: true,
      admin: { readOnly: true },
    },
  ],
}
