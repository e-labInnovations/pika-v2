import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { importStatementRows, parseStatement, type ImportRow, type StatementResult } from '@/utilities/statements/import'
import { loadLookups } from './transactions'

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

async function ownAccount(payload: Payload, user: User, id: string): Promise<boolean> {
  const acc = await payload.findByID({ collection: 'accounts', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  return !!acc && idOf(acc.user) === String(user.id)
}

/** Reads a bank statement PDF (base64) against the user's own account. */
export async function parseOwnStatement(
  payload: Payload,
  user: User,
  args: { file: string; password?: string | null; account?: string | null },
): Promise<{ result: StatementResult } | { error: string; code?: string }> {
  if (args.account && !(await ownAccount(payload, user, args.account))) return { error: 'Choose one of your accounts.' }
  try {
    return { result: await parseStatement(payload, user, { file: args.file, password: args.password ?? null, account: args.account ?? null }) }
  } catch (e) {
    const code = (e as { data?: { code?: string } }).data?.code
    return { error: message(e, 'Could not read the statement.'), ...(code ? { code } : {}) }
  }
}

/** Adds the picked statement rows to the user's own account; every id must be theirs. */
export async function importOwnRows(payload: Payload, user: User, account: string, rows: ImportRow[]): Promise<{ ids: string[] } | { error: string; ids?: string[] }> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Pick at least one row.' }
  if (rows.length > 500) return { error: 'Import at most 500 rows at a time.' }
  if (!(await ownAccount(payload, user, account))) return { error: 'Choose one of your accounts.' }
  const l = await loadLookups(payload, user)
  for (const [i, r] of rows.entries()) {
    if (!r || typeof r !== 'object' || (r.tags !== undefined && !Array.isArray(r.tags))) return { error: `Row ${i + 1}: invalid.` }
    const cat = l.categories.find((c) => c.id === r.category)
    if (!cat || !cat.parentId || cat.type !== r.type) return { error: `Row ${i + 1}: choose a ${r.type} category.` }
    if ((r.tags ?? []).some((t) => !l.tags.some((x) => x.id === t))) return { error: `Row ${i + 1}: choose your own tags.` }
    if (r.person && !l.people.some((x) => x.id === r.person)) return { error: `Row ${i + 1}: choose one of your people.` }
  }
  // One row at a time, so a failure part-way reports what was already added (the page drops
  // those rows) and a retry doesn't add them twice.
  const ids: string[] = []
  for (const [i, r] of rows.entries()) {
    try {
      ids.push(...(await importStatementRows(payload, user, account, [r])))
    } catch (e) {
      return { error: `Row ${i + 1}: ${message(e, 'could not be added')}. ${ids.length} added before it.`, ids }
    }
  }
  return { ids }
}
