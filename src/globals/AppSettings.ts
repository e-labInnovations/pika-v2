import type { GlobalConfig } from 'payload'
import { maskApiKey, isMaskedKey } from '../utilities/maskApiKey'
import { isAdmin, isAdminField } from '@/access/isAdmin'
import { isAuthenticated } from '@/access/isAuthenticated'

export const AppSettings: GlobalConfig = {
  slug: 'app-settings',
  label: 'App Settings',
  access: {
    read: isAuthenticated,
    update: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        if (data?.ai?.geminiApiKey && isMaskedKey(data.ai.geminiApiKey)) {
          data.ai.geminiApiKey = originalDoc?.ai?.geminiApiKey ?? null
        }
        if (data?.ai?.hfApiKey && isMaskedKey(data.ai.hfApiKey)) {
          data.ai.hfApiKey = originalDoc?.ai?.hfApiKey ?? null
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
        if (doc?.ai?.hfApiKey) {
          doc.ai.hfApiKey = maskApiKey(doc.ai.hfApiKey)
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
          access: { read: isAdminField },
          admin: {
            description:
              'App-level Gemini API key. Used when the active model is a Gemini model and no user key is configured.',
            components: {
              Field: '@/components/admin/ApiKeyField#ApiKeyField',
            },
          },
        },
        {
          name: 'hfApiKey',
          type: 'text',
          label: 'HuggingFace API Key',
          access: { read: isAdminField },
          admin: {
            description:
              'App-level HuggingFace API key. Used when the active model is a HuggingFace model and no user key is configured.',
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
              'When enabled, users with their own Gemini or HuggingFace API key will use it instead of the app key.',
          },
        },
        {
          name: 'defaultModel',
          type: 'text',
          label: 'Default Model ID',
          defaultValue: 'gemini-2.5-flash',
          admin: {
            description: 'Model ID used when the user has no preferred model set. Must match an ID in the models list below.',
            components: {
              Field: '@/components/admin/DefaultModelPickerField#DefaultModelPickerField',
            },
          },
        },
        {
          name: 'models',
          type: 'array',
          label: 'Available Models',
          admin: {
            description: 'Models users can select. The ID is the exact model identifier sent to the API.',
            components: {
              RowLabel: '@/components/admin/ModelRowLabel#ModelRowLabel',
            },
          },
          defaultValue: [
            { id: 'gemini-2.5-flash',                name: 'Gemini 2.5 Flash',        provider: 'gemini',       enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
            { id: 'gemini-2.5-pro',                  name: 'Gemini 2.5 Pro',          provider: 'gemini',       enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
            { id: 'gemini-2.0-flash',                name: 'Gemini 2.0 Flash',        provider: 'gemini',       enabled: true, maxUserMonthlyTokens: 0, contextWindow: 1048576 },
            { id: 'Qwen/Qwen3-VL-8B-Instruct',       name: 'Qwen3-VL 8B Instruct',   provider: 'huggingface',  enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
            { id: 'Qwen/Qwen3-VL-30B-A3B-Instruct',  name: 'Qwen3-VL 30B Instruct',  provider: 'huggingface',  enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
            { id: 'Qwen/Qwen3-VL-235B-A22B-Instruct', name: 'Qwen3-VL 235B Instruct', provider: 'huggingface', enabled: true, maxUserMonthlyTokens: 0, contextWindow: 131072 },
          ],
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'id',
                  type: 'text',
                  label: 'Model ID',
                  required: true,
                  admin: { placeholder: 'e.g. gemini-2.5-flash or Qwen/Qwen3-VL-8B-Instruct' },
                },
                {
                  name: 'name',
                  type: 'text',
                  label: 'Display Name',
                  required: true,
                  admin: { placeholder: 'e.g. Gemini 2.5 Flash' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'provider',
                  type: 'select',
                  label: 'Provider',
                  required: true,
                  options: [
                    { label: 'Gemini', value: 'gemini' },
                    { label: 'HuggingFace', value: 'huggingface' },
                  ],
                },
                {
                  name: 'enabled',
                  type: 'checkbox',
                  label: 'Enabled',
                  defaultValue: true,
                  admin: { description: 'Uncheck to disable this model without removing it.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'maxUserMonthlyTokens',
                  type: 'number',
                  label: 'Max Tokens Per User / Month',
                  defaultValue: 0,
                  min: 0,
                  admin: { description: 'Token limit per user per month for this model. 0 = unlimited.' },
                },
                {
                  name: 'contextWindow',
                  type: 'number',
                  label: 'Context Window (tokens)',
                  defaultValue: 0,
                  min: 0,
                  admin: { description: 'Maximum context length of this model. Informational only.' },
                },
              ],
            },
          ],
        },
        {
          name: 'perUserDailyTokenLimit',
          type: 'number',
          label: 'Per-User Daily Token Limit',
          defaultValue: 100000,
          min: 0,
          admin: {
            description: 'Maximum tokens a user may consume per day using the app key. Set to 0 for unlimited.',
          },
        },
        {
          name: 'perUserMonthlyTokenLimit',
          type: 'number',
          label: 'Per-User Monthly Token Limit',
          defaultValue: 1000000,
          min: 0,
          admin: {
            description: 'Maximum tokens a user may consume per month using the app key. Set to 0 for unlimited.',
          },
        },
        {
          name: 'predictionEnabled',
          type: 'checkbox',
          label: 'Enable Local Category Prediction',
          defaultValue: true,
          admin: {
            description:
              'Uses a small on-server ML model (transformers.js) to auto-suggest categories as the user types. No external API call.',
          },
        },
        {
          name: 'embeddingBackfillAction',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/admin/EmbeddingBackfillField#EmbeddingBackfillField',
            },
          },
        },
      ],
    },
  ],
}
