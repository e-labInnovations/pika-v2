import type { CollectionConfig } from 'payload'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { userField } from '../fields'

/**
 * Bank/wallet SMS forwarded by the phone (see utilities/sms). Each is parsed on
 * arrival and waits as `pending` until the user confirms it into a transaction or
 * dismisses it. Rows are only created by the ingest endpoint, never directly.
 */
export const CapturedSms: CollectionConfig = {
  slug: 'captured-sms',
  labels: { singular: 'Captured SMS', plural: 'Captured SMS' },
  graphQL: { singularName: 'CapturedSms', pluralName: 'CapturedSmsList' },
  admin: {
    useAsTitle: 'sender',
    defaultColumns: ['sender', 'status', 'receivedAt', 'user'],
    group: 'Pika',
  },
  access: {
    create: () => false,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  fields: [
    userField,
    { name: 'sender', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'receivedAt', type: 'date', required: true, index: true },
    {
      name: 'hash',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Dismissed', value: 'dismissed' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Unparsed', value: 'unparsed' },
      ],
    },
    {
      name: 'parsed',
      type: 'json',
      admin: { readOnly: true, description: 'What the parser read from the SMS.' },
    },
    {
      name: 'merchantKey',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'Normalised merchant, used to learn from confirmed SMS.' },
    },
    {
      name: 'suggestion',
      type: 'json',
      admin: { readOnly: true, description: 'Prefill (title, category, tags, person) from your history.' },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      // No user = a server-side write (the ingest endpoint), which sets the account itself.
      filterOptions: ({ user }) => (user ? { user: { equals: user.id } } : true),
    },
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      admin: { description: 'The confirmed transaction, or the existing one this SMS duplicates.' },
    },
    {
      name: 'autoConfirmed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { description: 'Confirmed on arrival because the merchant is trusted.' },
    },
    {
      name: 'autoUndone',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'An auto-confirm the user undid; stops auto-confirming this merchant until confirmed again.' },
    },
  ],
}
