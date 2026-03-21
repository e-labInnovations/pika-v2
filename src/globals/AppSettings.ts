import type { GlobalConfig } from 'payload'
import { maskApiKey, isMaskedKey } from '../utilities/maskApiKey'
import { isAdmin } from '@/access/isAdmin'

export const AppSettings: GlobalConfig = {
  slug: 'app-settings',
  label: 'App Settings',
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        if (data?.ai?.geminiApiKey && isMaskedKey(data.ai.geminiApiKey)) {
          if (!data.ai) data.ai = {}
          data.ai.geminiApiKey = originalDoc?.ai?.geminiApiKey ?? null
        }
        return data
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        if (req?.context?.internal) return doc
        if (doc?.ai?.geminiApiKey) {
          doc.ai.geminiApiKey = maskApiKey(doc.ai.geminiApiKey)
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'ai',
      type: 'group',
      label: 'AI Configuration',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable AI Features',
          defaultValue: true,
          admin: {
            description: 'Master switch for all AI features across the app.',
          },
        },
        {
          name: 'geminiApiKey',
          type: 'text',
          label: 'Gemini API Key',
          admin: {
            description:
              'App-level Gemini API key. Used as fallback when a user has no personal key configured.',
            components: {
              Field: '@/components/admin/ApiKeyField#ApiKeyField',
            },
          },
        },
        {
          name: 'allowUserApiKey',
          type: 'checkbox',
          label: 'Allow User API Keys',
          defaultValue: true,
          admin: {
            description:
              'When enabled, users with their own Gemini API key will use it instead of the app key.',
          },
        },
        {
          name: 'defaultModel',
          type: 'text',
          label: 'Default Model',
          defaultValue: 'gemini-2.5-flash',
          admin: {
            description: 'Model used when no model is specified in the request.',
          },
        },
        {
          name: 'models',
          type: 'array',
          label: 'Available Models',
          admin: {
            description:
              'List of model IDs clients can choose from. Leave empty to allow any model.',
          },
          defaultValue: [
            { name: 'gemini-2.5-flash' },
            { name: 'gemini-2.5-pro' },
            { name: 'gemini-2.0-flash' },
          ],
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              admin: { placeholder: 'e.g. gemini-2.5-flash' },
            },
          ],
        },
        {
          name: 'perUserDailyLimit',
          type: 'number',
          label: 'Per-User Daily Limit',
          defaultValue: 20,
          min: 0,
          admin: {
            description: 'Maximum AI requests per user per day. Set to 0 for unlimited.',
          },
        },
        {
          name: 'perUserMonthlyLimit',
          type: 'number',
          label: 'Per-User Monthly Limit',
          defaultValue: 200,
          min: 0,
          admin: {
            description: 'Maximum AI requests per user per month. Set to 0 for unlimited.',
          },
        },
      ],
    },
  ],
}
