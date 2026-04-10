/**
 * Shared MCP constants — no imports, safe to use in both server and client components.
 */

/** OAuth scopes advertised in discovery endpoints. */
export const MCP_SCOPES = [
  'transactions:read',
  'transactions:write',
  'accounts:read',
  'accounts:write',
  'people:read',
  'people:write',
  'categories:read',
  'tags:read',
  'reminders:read',
  'reminders:write',
  'transaction-links:read',
  'transaction-links:write',
]

/** Full permission set granted to MCP OAuth clients via the consent screen. */
export const MCP_FULL_PERMISSIONS = {
  transactions: { find: true, create: true, update: true, delete: true },
  accounts: { find: true, create: true, update: true, delete: true },
  people: { find: true, create: true, update: true, delete: true },
  categories: { find: true, create: true, update: true, delete: true },
  tags: { find: true, create: true, update: true, delete: true },
  reminders: { find: true, create: true, update: true, delete: true },
  'transaction-links': { find: true, create: true, update: true, delete: true },
  userSettings: { find: true, update: true },
  users: { find: true },
  media: { find: true },
  'payload-mcp-tool': {
    getDashboardSummary: true,
    getMonthlyCategories: true,
    getMonthlyTags: true,
    getMonthlyPeople: true,
    getCurrentUser: true,
  },
  'payload-mcp-resource': {
    currencies: true,
    currency: true,
    timezones: true,
    timezone: true,
  },
}
