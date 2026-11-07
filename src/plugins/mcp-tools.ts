import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import type { User } from '../payload-types'
import { contextForModel, loadContext } from '../utilities/mcp/context'
import { getBalances, getOverview, smsQueue, splitTransactionByName, type SmsQueueArgs } from '../utilities/mcp/more'
import {
  addTransactions,
  deleteTransactions,
  searchTransactions,
  updateTransactions,
  MAX_BATCH,
  type AddItem,
  type SearchArgs,
  type UpdateItem,
} from '../utilities/mcp/transactions'

/**
 * Task tools for chat assistants (ChatGPT first): names instead of ids, local times,
 * batches. See docs/superpowers/specs/2026-11-08-mcp-v2-design.md.
 */

const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })

async function run(req: PayloadRequest, fn: (user: User) => Promise<unknown>) {
  if (!req.user) return text({ error: 'Unauthorized' })
  try {
    return text(await fn(req.user as User))
  } catch (e: any) {
    return text({ error: e?.data?.errors?.map((x: any) => x.message).join('; ') || e?.message || 'Failed' })
  }
}

const DATE = 'Local date/time as "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" in the user\'s timezone (see get_context). Do NOT convert to UTC.'
const NAME = (what: string) => `${what} name (or id) from get_context.`

const txFields = {
  title: z.string().describe('Short title, e.g. "Lunch at Paragon".'),
  amount: z.number().positive().describe('Positive amount in the user\'s currency.'),
  date: z.string().describe(DATE),
  type: z.enum(['expense', 'income', 'transfer']),
  account: z.string().describe(NAME('Account')),
  to_account: z.string().optional().describe('Transfers only: destination account name.'),
  category: z.string().describe(`${NAME('Category')} Must match the type; "Parent > Child" is accepted.`),
  tags: z.array(z.string()).optional().describe('Tag names.'),
  person: z.string().optional().describe('Person name: who was paid / who paid.'),
  note: z.string().optional(),
  shares: z
    .array(z.object({ person: z.string().describe('Person name.'), amount: z.number().positive() }))
    .optional()
    .describe("Expenses only: friends' shares (money each owes you)."),
}

const partSchema = z.object({
  title: z.string().optional(),
  amount: z.number().positive(),
  category: z.string().describe(NAME('Category')),
  tags: z.array(z.string()).optional(),
  person: z.string().optional(),
})

type PikaTool = {
  name: string
  description: string
  parameters: z.ZodRawShape
  handler: (args: Record<string, unknown>, req: PayloadRequest) => Promise<{ content: { type: 'text'; text: string }[] }>
}

export const pikaTools: PikaTool[] = [
  {
    name: 'get_context',
    description:
      "Call this FIRST. Returns the user's current local date/time and timezone, currency, and every account, category (grouped by type and parent), tag and person with ids. Use these names in other tools; never guess ids.",
    parameters: {},
    handler: (_: Record<string, unknown>, req: PayloadRequest) =>
      run(req, async (user) => contextForModel(await loadContext(req.payload, user))),
  },
  {
    name: 'add_transactions',
    description: `Add 1–${MAX_BATCH} transactions in one call. Use names for account/category/tags/person and LOCAL dates. Each item is checked against existing transactions; a likely duplicate is not saved unless allow_duplicate is true. Use dry_run to preview. Returns a result per item (created / duplicate / error with the reason).`,
    parameters: {
      transactions: z
        .array(z.object({ ...txFields, allow_duplicate: z.boolean().optional() }))
        .min(1)
        .max(MAX_BATCH),
      dry_run: z.boolean().optional().describe('Check and preview without saving.'),
    },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, (user) => addTransactions(req.payload, user, args as { transactions: AddItem[]; dry_run?: boolean })),
  },
  {
    name: 'update_transactions',
    description: `Change 1–${MAX_BATCH} transactions by id (from search_transactions). Only the fields given change. Names and LOCAL dates as in add_transactions; person: "" clears it.`,
    parameters: {
      transactions: z
        .array(
          z.object({
            id: z.string(),
            title: txFields.title.optional(),
            amount: txFields.amount.optional(),
            date: txFields.date.optional(),
            type: txFields.type.optional(),
            account: txFields.account.optional(),
            to_account: txFields.to_account,
            category: z.string().optional().describe(NAME('Category')),
            tags: txFields.tags,
            person: txFields.person,
            note: txFields.note,
            shares: txFields.shares,
          }),
        )
        .min(1)
        .max(MAX_BATCH),
    },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, (user) => updateTransactions(req.payload, user, args as { transactions: UpdateItem[] })),
  },
  {
    name: 'delete_transactions',
    description: `Delete 1–${MAX_BATCH} transactions by id. Confirm with the user first.`,
    parameters: { ids: z.array(z.string()).min(1).max(MAX_BATCH) },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, (user) => deleteTransactions(req.payload, user, args as { ids: string[] })),
  },
  {
    name: 'search_transactions',
    description:
      "Find transactions and total them. 'query' matches title, note, category/tag/person/account names and exact amounts. Filters take names and LOCAL dates. Returns totals over ALL matches (count, spent, received, average), spending by month, and one page of rows (local times, names).",
    parameters: {
      query: z.string().optional(),
      type: z.enum(['expense', 'income', 'transfer']).optional(),
      categories: z.array(z.string()).optional().describe('Category names; a parent name includes its subcategories.'),
      tags: z.array(z.string()).optional(),
      people: z.array(z.string()).optional(),
      accounts: z.array(z.string()).optional(),
      date_from: z.string().optional().describe('Local date "YYYY-MM-DD", inclusive.'),
      date_to: z.string().optional().describe('Local date "YYYY-MM-DD", inclusive.'),
      amount_min: z.number().optional(),
      amount_max: z.number().optional(),
      sort: z.enum(['newest', 'oldest', 'highest', 'lowest']).optional(),
      limit: z.number().int().min(1).max(100).optional().describe('Rows per page (default 25).'),
      page: z.number().int().min(1).optional(),
    },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, (user) => searchTransactions(req.payload, user, args as SearchArgs)),
  },
  {
    name: 'get_overview',
    description:
      "This month at a glance: total balance, income, expenses, surplus, insights (what's unusual) and budget progress. Good for 'how am I doing?'.",
    parameters: {},
    handler: (_: Record<string, unknown>, req: PayloadRequest) => run(req, (user) => getOverview(req.payload, user)),
  },
  {
    name: 'get_balances',
    description: 'Balance of every account, and people with money outstanding (owes_you / you_owe).',
    parameters: {},
    handler: (_: Record<string, unknown>, req: PayloadRequest) => run(req, (user) => getBalances(req.payload, user)),
  },
  {
    name: 'sms_queue',
    description:
      "Bank SMS waiting for review. action 'list': pending SMS with suggestions. 'confirm': save one as a transaction (optionally change title/category/account/tags/person/note by name). 'split': save it as several transactions (parts must add up to the SMS amount). 'dismiss': not a transaction.",
    parameters: {
      action: z.enum(['list', 'confirm', 'split', 'dismiss']),
      id: z.string().optional().describe('SMS id from list (for confirm/split/dismiss).'),
      limit: z.number().int().min(1).max(50).optional(),
      title: z.string().optional(),
      category: z.string().optional(),
      account: z.string().optional(),
      tags: z.array(z.string()).optional(),
      person: z.string().optional(),
      note: z.string().optional(),
      parts: z.array(partSchema).optional().describe('For split: 2+ parts adding up to the SMS amount.'),
    },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, async (user) => {
        if (args.action !== 'list' && !args.id) return { error: `id is required for ${String(args.action)}.` }
        return smsQueue(req.payload, user, args as SmsQueueArgs)
      }),
  },
  {
    name: 'split_transaction',
    description:
      'Split a saved transaction (id from search_transactions) into parts by name; parts must add up to its amount. It stays as the first part; the rest are new transactions with the same date and account.',
    parameters: { id: z.string(), parts: z.array(partSchema).min(2) },
    handler: (args: Record<string, unknown>, req: PayloadRequest) =>
      run(req, (user) => splitTransactionByName(req.payload, user, args as { id: string; parts: any[] })),
  },
]
