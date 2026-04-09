import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { isNotSystem } from '../access/isNotSystem'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields'

/**
 * Prevent self-linking and optionally duplicate links (same from + to + type)
 */
const validateLink: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const from = data?.from ?? (operation === 'update' ? originalDoc?.from : undefined)
  const to = data?.to ?? (operation === 'update' ? originalDoc?.to : undefined)
  const type = data?.type ?? (operation === 'update' ? originalDoc?.type : undefined)

  const errors: { message: string; path: string }[] = []

  const fromId = typeof from === 'object' ? from?.id : from
  const toId = typeof to === 'object' ? to?.id : to

  if (fromId && toId && String(fromId) === String(toId)) {
    errors.push({ message: 'A transaction cannot be linked to itself.', path: 'to' })
  }

  // Prevent duplicate links with same from + to + type
  if (fromId && toId && type) {
    const existing = await req.payload.find({
      collection: 'transaction-links',
      where: {
        and: [
          { from: { equals: fromId } },
          { to: { equals: toId } },
          { type: { equals: type } },
          ...(operation === 'update' && originalDoc?.id
            ? [{ id: { not_equals: originalDoc.id } }]
            : []),
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (existing.totalDocs > 0) {
      errors.push({
        message: `A "${type}" link from this transaction already exists.`,
        path: 'type',
      })
    }
  }

  if (errors.length) throw new ValidationError({ errors })
  return data
}

export const TransactionLinks: CollectionConfig = {
  slug: 'transaction-links',
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['from', 'to', 'type', 'user'],
    group: 'Pika',
  },
  access: {
    create: isNotSystem,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate, validateLink],
  },
  fields: [
    userField,
    {
      name: 'from',
      type: 'relationship',
      relationTo: 'transactions',
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
      admin: {
        description: 'The source transaction (the action)',
      },
    },
    {
      name: 'to',
      type: 'relationship',
      relationTo: 'transactions',
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
      admin: {
        description: 'The target transaction (the reference)',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Repaid', value: 'repaid' },
        { label: 'Returned', value: 'returned' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Correction', value: 'correction' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: 'Additional context for this link',
      },
    },
  ],
}
