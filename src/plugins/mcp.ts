import { MCPAccessSettings, mcpPlugin } from '@payloadcms/plugin-mcp'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { currencies } from '../data/currencies'
import { timezones } from '../data/timezones'
import { calculateDashboard } from '../utilities/calculateDashboard'
import { calculateMonthlyCategories } from '../utilities/calculateMonthlyCategories'
import { calculateMonthlyTags } from '../utilities/calculateMonthlyTags'
import { calculateMonthlyPeople } from '../utilities/calculateMonthlyPeople'
import { User } from '../payload-types'
import { PayloadRequest } from 'payload'
import { maskApiKey } from '../utilities/maskApiKey'

export { MCP_SCOPES, MCP_FULL_PERMISSIONS } from './mcp-constants'

async function getMcpTimezone(req: PayloadRequest): Promise<string> {
  if (!req.user) return 'UTC'
  try {
    const settings = await req.payload.find({
      collection: 'user-settings',
      where: { user: { equals: req.user.id } },
      limit: 1,
      depth: 0,
      context: { internal: true },
    })
    return (settings.docs[0]?.timezone as string) || 'UTC'
  } catch {
    return 'UTC'
  }
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3333'

export const mcp = mcpPlugin({
  overrideAuth: async (
    req: PayloadRequest,
    getDefaultMcpAccessSettings: () => Promise<MCPAccessSettings>,
  ) => {
    const mcpAccessSettings = await getDefaultMcpAccessSettings()
    // Set req.user to the actual users record so custom tool handlers can use req.user.id
    req.user = mcpAccessSettings.user
    return mcpAccessSettings
  },
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
        'Uploaded files and images (avatars, account icons, etc.) referenced by other collections. Read-only — upload via the UI.',
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
    'transaction-links': {
      description:
        'Links between transactions capturing semantic relationships such as repayments, returns, duplicates, and corrections. Each link has a source transaction (from), a target transaction (to), a type, and an optional note. Use this to track when one transaction settles or relates to another.',
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
        'Per-user preferences: currency code (default USD), timezone (default UTC), locale (default en), UI theme (light / dark / system), default account for new transactions, Gemini API key for AI features, and a flexible JSON settings bag for any additional app-level config. One record per user.',
      enabled: {
        find: true,
        create: false,
        update: true,
        delete: false,
      },
    },
  },
  mcp: {
    serverOptions: {
      // icons is a draft MCP spec field — cast needed until plugin types catch up
      serverInfo: {
        name: 'Pika',
        version: '1.0.0',
        icons: [
          { src: `${SERVER_URL}/icon.svg`, mimeType: 'image/svg+xml', sizes: ['any'] },
          { src: `${SERVER_URL}/icons/favicon.ico`, mimeType: 'image/x-icon', sizes: ['48x48'] },
        ],
      } as { name: string; version: string },
    },
    tools: [
      {
        name: 'get_dashboard_summary',
        description:
          "Returns the authenticated user's financial dashboard: total balance across all active accounts, percentage change vs last month's surplus, and current month income/expenses/surplus. Use this to answer questions like 'how am I doing this month?' or 'what is my total balance?'",
        parameters: {},
        handler: async (_args: Record<string, unknown>, req: PayloadRequest) => {
          if (!req.user) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unauthorized' }) }],
            }
          }
          const timezone = await getMcpTimezone(req)
          const data = await calculateDashboard(req.payload, req.user.id, timezone)
          return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
        },
      },
      {
        name: 'get_monthly_categories',
        description:
          "Returns expense spending grouped by category for a given month, including per-category totals, transaction counts, averages, and parent rollup. Use this to answer questions like 'what did I spend on food this month?' or 'show my top spending categories'.",
        parameters: {
          month: z
            .number()
            .int()
            .min(1)
            .max(12)
            .optional()
            .describe('Month number 1–12 (defaults to current month)'),
          year: z
            .number()
            .int()
            .min(2000)
            .optional()
            .describe('Full year e.g. 2026 (defaults to current year)'),
        },
        handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
          if (!req.user) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unauthorized' }) }],
            }
          }
          const now = new Date()
          const month = (args.month as number) ?? now.getMonth() + 1
          const year = (args.year as number) ?? now.getFullYear()
          const timezone = await getMcpTimezone(req)
          const data = await calculateMonthlyCategories(
            req.payload,
            req.user.id,
            month,
            year,
            timezone,
          )
          return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
        },
      },
      {
        name: 'get_monthly_tags',
        description:
          "Returns transaction activity grouped by tag for a given month, split by expense/income/transfer. Use this to answer questions like 'how much did I spend on subscriptions?' or 'show activity by tag this month'.",
        parameters: {
          month: z
            .number()
            .int()
            .min(1)
            .max(12)
            .optional()
            .describe('Month number 1–12 (defaults to current month)'),
          year: z
            .number()
            .int()
            .min(2000)
            .optional()
            .describe('Full year e.g. 2026 (defaults to current year)'),
        },
        handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
          if (!req.user) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unauthorized' }) }],
            }
          }
          const now = new Date()
          const month = (args.month as number) ?? now.getMonth() + 1
          const year = (args.year as number) ?? now.getFullYear()
          const timezone = await getMcpTimezone(req)
          const data = await calculateMonthlyTags(req.payload, req.user.id, month, year, timezone)
          return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
        },
      },
      {
        name: 'get_current_user',
        description:
          "Returns the authenticated user's profile (id, email, name, role) and their current settings (currency, timezone, locale, theme). Use this to identify who is connected or to resolve user-specific defaults before making other API calls.",
        parameters: {},
        handler: async (_args: Record<string, unknown>, req: PayloadRequest) => {
          if (!req.user) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unauthorized' }) }],
            }
          }
          const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
            depth: 1,
            overrideAccess: true,
            context: { internal: true },
          })
          const rawSettings = (user.settings as User['settings'])?.docs?.[0] ?? null
          const userSetting = typeof rawSettings === 'object' ? rawSettings : null
          const settings = userSetting
            ? {
                ...userSetting,
                geminiApiKey: userSetting.geminiApiKey
                  ? maskApiKey(userSetting.geminiApiKey)
                  : null,
              }
            : null
          const result = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            settings,
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
        },
      },
      {
        name: 'get_monthly_people',
        description:
          "Returns monthly transaction activity per person plus their all-time balance. Use this to answer questions like 'how much did I lend to John this month?' or 'who do I owe money to?'.",
        parameters: {
          month: z
            .number()
            .int()
            .min(1)
            .max(12)
            .optional()
            .describe('Month number 1–12 (defaults to current month)'),
          year: z
            .number()
            .int()
            .min(2000)
            .optional()
            .describe('Full year e.g. 2026 (defaults to current year)'),
        },
        handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
          if (!req.user) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unauthorized' }) }],
            }
          }
          const now = new Date()
          const month = (args.month as number) ?? now.getMonth() + 1
          const year = (args.year as number) ?? now.getFullYear()
          const timezone = await getMcpTimezone(req)
          const data = await calculateMonthlyPeople(req.payload, req.user.id, month, year, timezone)
          return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
        },
      },
    ],
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
