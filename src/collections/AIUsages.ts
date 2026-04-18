import type { CollectionConfig } from 'payload'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { userField } from '../fields/userField'
import { isAdmin } from '@/access/isAdmin'

export const AIUsages: CollectionConfig = {
  slug: 'ai-usages',
  admin: {
    useAsTitle: 'promptType',
    defaultColumns: [
      'user',
      'promptType',
      'model',
      'status',
      'totalTokens',
      'latencyMs',
      'createdAt',
    ],
  },
  access: {
    read: isAdminOrOwn,
    create: () => false, // only server-side via overrideAccess
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    userField,
    {
      name: 'promptType',
      type: 'select',
      required: true,
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Image', value: 'image' },
        { label: 'Category Suggestion', value: 'category-suggestion' },
        { label: 'Category Prediction', value: 'category-prediction' },
      ],
    },
    {
      name: 'model',
      type: 'text',
    },
    {
      name: 'promptTokens',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'candidateTokens',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'totalTokens',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'latencyMs',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
      ],
    },
    {
      name: 'apiKeyType',
      type: 'select',
      options: [
        { label: 'User', value: 'user' },
        { label: 'App', value: 'app' },
      ],
    },
    {
      name: 'error',
      type: 'text',
    },
  ],
}
