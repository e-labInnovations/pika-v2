import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { currencies } from '../data/currencies'
import { timezones } from '../data/timezones'

export const mcp = mcpPlugin({
  collections: {
    users: {
      description:
        'App users with role-based access (admin, user, system). Every other record in the system is owned by a user. Use this to look up who owns a record or to resolve user IDs.',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
    media: {
      description:
        'Uploaded files and images (avatars, account icons, etc.) referenced by other collections. Read-only — upload via the admin UI.',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
    accounts: {
      description:
        'Financial accounts such as bank accounts, wallets, or credit cards. Each account belongs to a user and has a name, optional icon, background color, text color, and avatar. Used as the source or destination of transactions.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    people: {
      description:
        'Contacts and counterparties associated with transactions (e.g. a merchant, a friend you split a bill with). Stores name, email, phone, avatar, description, and active status.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    categories: {
      description:
        'Transaction categories that classify money movement as income, expense, or transfer. Supports hierarchical parent–child relationships. Can be user-owned or system-wide (shared across all users). Use type field to filter by direction.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    tags: {
      description:
        'Freeform labels for tagging transactions (e.g. "business", "subscriptions", "groceries"). Each tag has a name, icon, foreground color, and background color. Can be user-owned or system-wide.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    transactions: {
      description:
        'Core financial records. Each transaction has a title, amount (stored as text to preserve decimal precision), date, type (income / expense / transfer), and optional relationships to a category, account, tags, and a person. Use this to query spending patterns, compute totals, or create new entries.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    reminders: {
      description:
        'Scheduled or recurring financial reminders (e.g. rent, subscriptions, loan repayments). Has a title, optional amount, type (income / expense / transfer), linked category and account, a next due date, and an archived flag. Use to surface upcoming obligations.',
      enabled: {
        find: true,
        create: true,
        update: true,
        delete: true,
      },
    },
    'user-settings': {
      description:
        "Per-user preferences: currency code (default USD), timezone (default UTC), locale (default en), UI theme (light / dark / system), default account for new transactions, Gemini API key for AI features, and a flexible JSON settings bag for any additional app-level config. One record per user.",
      enabled: {
        find: true,
        create: false,
        update: true,
        delete: false,
      },
    },
  },
  mcp: {
    resources: [
      {
        name: 'currencies',
        title: 'All Currencies',
        description:
          'Complete list of supported currencies with their ISO code, symbol, native symbol, plural name, decimal digits, and rounding. Use this to look up currency metadata or present options for user preference selection.',
        uri: 'currencies://all',
        mimeType: 'application/json',
        handler: (uri: URL) => ({
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(
                Object.values(currencies).sort((a, b) => a.code.localeCompare(b.code)),
                null,
                2,
              ),
            },
          ],
        }),
      },
      {
        name: 'currency',
        title: 'Currency by Code',
        description:
          'Returns metadata for a single currency by its ISO 4217 code (e.g. USD, EUR, GBP). Includes symbol, native symbol, plural name, decimal digits, and rounding precision.',
        uri: new ResourceTemplate('currencies://code/{code}', { list: undefined }),
        mimeType: 'application/json',
        handler: (uri: URL, { code }: { code: string }) => {
          const currency = currencies[code.toUpperCase()]
          return {
            contents: [
              {
                uri: uri.href,
                text: currency
                  ? JSON.stringify(currency, null, 2)
                  : JSON.stringify({ error: `Currency '${code}' not found` }),
              },
            ],
          }
        },
      },
      {
        name: 'timezones',
        title: 'All Timezones',
        description:
          'Complete list of supported IANA timezones grouped by region with UTC offset and display label. Use this to look up timezone metadata or present options for user preference selection.',
        uri: 'timezones://all',
        mimeType: 'application/json',
        handler: (uri: URL) => ({
          contents: [{ uri: uri.href, text: JSON.stringify(timezones, null, 2) }],
        }),
      },
      {
        name: 'timezone',
        title: 'Timezone by ID',
        description:
          'Returns metadata for a single IANA timezone by its ID (e.g. America/New_York, Europe/London). Includes region, city, UTC offset, and display label.',
        uri: new ResourceTemplate('timezones://id/{id}', { list: undefined }),
        mimeType: 'application/json',
        handler: (uri: URL, { id }: { id: string }) => {
          const tz = timezones.find((t) => t.id === decodeURIComponent(id))
          return {
            contents: [
              {
                uri: uri.href,
                text: tz
                  ? JSON.stringify(tz, null, 2)
                  : JSON.stringify({ error: `Timezone '${id}' not found` }),
              },
            ],
          }
        },
      },
    ],
  },
})
