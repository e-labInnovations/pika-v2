import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { preventDeleteIfUsedInTransactions } from '../hooks/preventDeleteIfUsedInTransactions'
import { userField, isActiveField, descriptionField } from '../fields'
import { calculatePersonBalance } from '../utilities/calculatePersonBalance'

export const People: CollectionConfig = {
  slug: 'people',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'isActive', 'user'],
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
    beforeDelete: [preventDeleteIfUsedInTransactions('person')],
    afterRead: [
      async ({ doc, req }) => {
        if (!req?.payload || !doc?.id) return doc
        const balanceData = await calculatePersonBalance(req.payload, doc.id)
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
      name: 'email',
      type: 'email',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    descriptionField,
    {
      name: 'upiIds',
      type: 'text',
      label: 'UPI IDs / SMS names',
      admin: {
        description:
          'How bank SMS name this person, comma separated: UPI IDs (name@okaxis) or the payee name as the SMS writes it (ELIZEBETH S). Used to fill in the person on captured SMS; confirming an SMS with this person adds new ones.',
      },
    },
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
    {
      name: 'totalSummary',
      type: 'json',
      virtual: true,
      admin: { readOnly: true },
    },
    {
      // Shared payments this person has not fully paid back: { transaction, title, date, share, paid, remaining }[]
      name: 'openShares',
      type: 'json',
      virtual: true,
      admin: { readOnly: true },
    },
  ],
}
