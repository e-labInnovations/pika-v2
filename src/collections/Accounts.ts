import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import {
  userField,
  iconField,
  colorField,
  bgColorField,
  isActiveField,
  descriptionField,
} from '../fields'
import { calculateAccountBalance } from '../utilities/calculateAccountBalance'

export const Accounts: CollectionConfig = {
  slug: 'accounts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isActive', 'user'],
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
    iconField('wallet'),
    bgColorField,
    colorField,
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    descriptionField,
    isActiveField,
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
