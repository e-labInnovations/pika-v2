import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields/userField'
import { currencies } from '../data/currencies'
import { maskApiKey, isMaskedKey } from '../utilities/maskApiKey'
import { validateTimezone } from '../utilities/validateTimezone'


export const UserSettings: CollectionConfig = {
  slug: 'user-settings',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'currency', 'theme'],
  },
  access: {
    create: isNotSystem,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [
      setUserOnCreate,
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        const userId = data?.user ?? req.user?.id
        if (!userId) return data
        const existing = await req.payload.find({
          collection: 'user-settings',
          where: { user: { equals: userId } },
          limit: 1,
          depth: 0,
        })
        if (existing.totalDocs > 0) {
          throw new Error('User settings already exist for this user.')
        }
        return data
      },
      async ({ data, originalDoc }) => {
        if (data?.geminiApiKey && isMaskedKey(data.geminiApiKey)) {
          data.geminiApiKey = originalDoc?.geminiApiKey ?? null
        }
        if (data?.hfApiKey && isMaskedKey(data.hfApiKey)) {
          data.hfApiKey = originalDoc?.hfApiKey ?? null
        }
        return data
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        if (req?.context?.internal) return doc
        if (doc?.geminiApiKey) {
          doc.geminiApiKey = maskApiKey(doc.geminiApiKey)
        }
        if (doc?.hfApiKey) {
          doc.hfApiKey = maskApiKey(doc.hfApiKey)
        }
        return doc
      },
    ],
  },
  fields: [
    { ...userField, unique: true },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'USD',
      validate: (value: string | null | undefined) => {
        if (!value) return 'Currency is required'
        if (!currencies[value.toUpperCase()]) return `'${value}' is not a valid currency code`
        return true
      },
      admin: {
        components: {
          Field: '@/components/admin/CurrencyPickerField#CurrencyPickerField',
        },
      },
    },
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'UTC',
      validate: (value: string | null | undefined) => validateTimezone(value),
      admin: {
        components: {
          Field: '@/components/admin/TimezonePickerField#TimezonePickerField',
        },
      },
    },
    {
      name: 'locale',
      type: 'text',
      defaultValue: 'en',
    },
    {
      name: 'theme',
      type: 'select',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'System', value: 'system' },
      ],
      defaultValue: 'system',
    },
    {
      name: 'defaultAccount',
      type: 'relationship',
      relationTo: 'accounts',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
      admin: {
        components: {
          Field: '@/components/admin/AccountPickerField#AccountPickerField',
        },
      },
    },
    {
      name: 'geminiApiKey',
      type: 'text',
      label: 'Gemini API Key',
      admin: {
        description:
          'Personal Gemini API key. Used when your preferred model is a Gemini model.',
        components: {
          Field: '@/components/admin/ApiKeyField#ApiKeyField',
        },
      },
    },
    {
      name: 'hfApiKey',
      type: 'text',
      label: 'HuggingFace API Key',
      admin: {
        description:
          'Personal HuggingFace API key. Used when your preferred model is a HuggingFace model.',
        components: {
          Field: '@/components/admin/ApiKeyField#ApiKeyField',
        },
      },
    },
    {
      name: 'preferredModel',
      type: 'text',
      label: 'Preferred AI Model ID',
      admin: {
        description:
          'Model ID to use for all AI features (must match an ID in the app model list). Leave blank to use the app default.',
        placeholder: 'e.g. gemini-2.5-flash or Qwen/Qwen3-VL-8B-Instruct',
      },
    },
    {
      name: 'allowFallback',
      type: 'checkbox',
      label: 'Allow Provider Fallback',
      defaultValue: true,
      admin: {
        description:
          'If no API key is available for your preferred model\'s provider, automatically fall back to the app\'s default model.',
      },
    },
    {
      name: 'categoryAiMethod',
      type: 'select',
      label: 'Category Suggestion Method',
      defaultValue: 'minilm',
      options: [
        { label: 'Local (MiniLM)', value: 'minilm' },
        { label: 'Cloud (AI Model)', value: 'cloud' },
      ],
      admin: {
        description:
          'Which backend powers category suggestions. Local is free and fast; Cloud uses your configured AI model and counts against quota.',
      },
    },
  ],
}
