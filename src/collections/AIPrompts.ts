import type { CollectionConfig } from 'payload'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { isAdmin } from '../access/isAdmin'
import { userField } from '../fields/userField'

export const AIPrompts: CollectionConfig = {
  slug: 'ai-prompts',
  admin: {
    useAsTitle: 'inputType',
    defaultColumns: ['user', 'inputType', 'model', 'transaction', 'createdAt'],
    group: 'Pika',
  },
  access: {
    read: isAdminOrOwn,
    create: () => false, // server-side only via overrideAccess
    update: () => false, // server-side only via overrideAccess
    delete: isAdmin,
  },
  fields: [
    userField,
    {
      name: 'inputType',
      type: 'select',
      required: true,
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Image', value: 'image' },
      ],
    },
    {
      name: 'inputText',
      type: 'textarea',
      admin: {
        condition: (data) => data?.inputType === 'text',
        description: 'The raw text provided by the user',
      },
    },
    {
      name: 'inputImage',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        condition: (data) => data?.inputType === 'image',
        description: 'The image uploaded by the user (stored in media)',
        readOnly: true,
      },
    },
    {
      name: 'systemPrompt',
      type: 'textarea',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'The system prompt sent to the model',
      },
    },
    {
      name: 'userPrompt',
      type: 'textarea',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'The full user context prompt sent to the model (categories, accounts, etc.)',
      },
    },
    {
      name: 'model',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'AI model used for this prompt',
      },
    },
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      admin: {
        readOnly: true,
        description: 'Transaction created from this prompt (populated after creation)',
      },
    },
  ],
}
