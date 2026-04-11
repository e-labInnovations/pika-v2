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
      // Prevent overwriting the real key when the masked placeholder is submitted unchanged
      async ({ data, originalDoc }) => {
        if (data?.geminiApiKey && isMaskedKey(data.geminiApiKey)) {
          data.geminiApiKey = originalDoc?.geminiApiKey ?? null
        }
        return data
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        // Skip masking for internal server-side reads (e.g. AI request handlers).
        // Pass context: { internal: true } when calling payload.find/findByID on the server.
        if (req?.context?.internal) return doc
        if (doc?.geminiApiKey) {
          doc.geminiApiKey = maskApiKey(doc.geminiApiKey)
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
          'Used for AI features. Stored securely — only the masked value is returned via the API.',
        components: {
          Field: '@/components/admin/ApiKeyField#ApiKeyField',
        },
      },
    },
  ],
}
