import { APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import { PdfPasswordError, pdfPages } from '../pdf'
import type { ParsedSms } from '../sms/parse'
import { loadAccounts, loadPeople, resolveAccount, suggest, type SmsSuggestion } from '../sms/ingest'
import { looksLikeFederalStatement, parseFederalStatement, type StatementRow } from './federal'

export type StatementRowResult = StatementRow & {
  index: number
  /** The Pika transaction this row already is, if any. */
  match: { id: string; title: string } | null
  /** Prefill for rows Pika is missing. */
  suggestion: SmsSuggestion | null
}

export type StatementResult = {
  bank: string
  accountNumber: string | null
  /** Pika account the statement was matched against (by SMS identifiers, or as given). */
  account: string | null
  from: string | null
  to: string | null
  openingBalance: number | null
  closingBalance: number | null
  rows: StatementRowResult[]
  missing: number
}

type Tx = { id: string; title: string; amount: number; delta: number; day: string; externalRef: string | null; note: string }

const IST_MS = 330 * 60_000
const istDay = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10)
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
/** Statement rows have no time; noon IST keeps them on the right day. */
export const statementRowDate = (day: string) => `${day}T06:30:00.000Z`

async function accountTransactions(payload: Payload, user: User, account: string, from: string, to: string): Promise<Tx[]> {
  const range = [
    { date: { greater_than_equal: statementRowDate(shiftDay(from, -2)) } },
    { date: { less_than_equal: statementRowDate(shiftDay(to, 2)) } },
  ]
  const res = await payload.find({
    collection: 'transactions',
    user,
    overrideAccess: false,
    where: {
      and: [
        ...range,
        { or: [{ account: { equals: account } }, { and: [{ type: { equals: 'transfer' } }, { toAccount: { equals: account } }] }] },
      ],
    },
    pagination: false,
    depth: 0,
    select: { title: true, amount: true, type: true, account: true, toAccount: true, date: true, externalRef: true, note: true },
  })
  return res.docs.map((t) => {
    const amount = parseFloat(t.amount as string) || 0
    const incoming = t.type === 'income' || (t.type === 'transfer' && String(t.toAccount) === account && String(t.account) !== account)
    return {
      id: String(t.id),
      title: t.title as string,
      amount,
      delta: incoming ? amount : -amount,
      day: istDay(t.date as string),
      externalRef: (t.externalRef as string | null) ?? null,
      note: (t.note as string | null) ?? '',
    }
  })
}

/**
 * Pairs statement rows with existing transactions, each used once: by bank reference
 * first, then same amount and direction on the same day, then a day either side
 * (value dates and late-night payments drift).
 */
export function matchRows(rows: StatementRow[], txs: Tx[]): (Tx | null)[] {
  const used = new Set<string>()
  const out: (Tx | null)[] = rows.map(() => null)
  const delta = (r: StatementRow) => (r.type === 'income' ? 1 : -1) * parseFloat(r.amount)
  const passes: ((r: StatementRow, t: Tx) => boolean)[] = [
    (r, t) => !!r.ref && r.ref.length >= 6 && (t.externalRef === r.ref || t.note.includes(r.ref)),
    (r, t) => Math.abs(t.delta - delta(r)) < 0.005 && t.day === r.date,
    (r, t) => Math.abs(t.delta - delta(r)) < 0.005 && (t.day === shiftDay(r.date, -1) || t.day === shiftDay(r.date, 1)),
  ]
  for (const pass of passes) {
    rows.forEach((r, i) => {
      if (out[i]) return
      const t = txs.find((x) => !used.has(x.id) && pass(r, x))
      if (t) {
        used.add(t.id)
        out[i] = t
      }
    })
  }
  return out
}

/** Reads a statement PDF and reports which rows Pika already has. Writes nothing. */
export async function parseStatement(
  payload: Payload,
  user: User,
  args: { file: string; password?: string | null; account?: string | null },
): Promise<StatementResult> {
  let pages: string[]
  try {
    pages = await pdfPages(args.file, args.password ?? undefined)
  } catch (e) {
    if (e instanceof PdfPasswordError) {
      throw new APIError(e.message, 400, { code: e.wrong ? 'pdf_password_wrong' : 'pdf_password_required' }, true)
    }
    throw new APIError('Could not read this PDF.', 400, undefined, true)
  }
  if (!looksLikeFederalStatement(pages.join('\n'))) {
    throw new APIError('Only Federal Bank account statements can be imported for now.', 400, { code: 'unsupported_statement' }, true)
  }
  const parsed = parseFederalStatement(pages)
  const userId = String(user.id)

  let account = args.account ?? null
  if (account) {
    // Access control: only the user's own account.
    await payload.findByID({ collection: 'accounts', id: account, depth: 0, user, overrideAccess: false })
  } else if (parsed.accountNumber) {
    account = resolveAccount(await loadAccounts(payload, userId), [parsed.accountNumber.slice(-4)])
  }

  const txs =
    account && parsed.rows.length
      ? await accountTransactions(payload, user, account, parsed.rows[0].date, parsed.rows[parsed.rows.length - 1].date)
      : []
  const matches = matchRows(parsed.rows, txs)
  const people = await loadPeople(payload, userId)

  const rows: StatementRowResult[] = []
  for (const [index, row] of parsed.rows.entries()) {
    const m = matches[index]
    let suggestion: SmsSuggestion | null = null
    if (!m) {
      const p: ParsedSms = {
        provider: 'federal',
        kind: row.type === 'income' ? 'imps_credit' : 'upi_debit',
        type: row.type,
        amount: row.amount,
        occurredAt: statementRowDate(row.date),
        merchant: row.payee,
        ref: row.ref,
        accountHints: [],
        balance: row.balance.toFixed(2),
      }
      const hint = row.hint ?? (row.payee ? `UPI ${row.type === 'income' ? 'from' : 'to'} ${row.payee}` : null)
      suggestion = await suggest(payload, userId, p, people, hint)
    }
    rows.push({ ...row, index, match: m ? { id: m.id, title: m.title } : null, suggestion })
  }

  return {
    bank: parsed.bank,
    accountNumber: parsed.accountNumber,
    account,
    from: parsed.from,
    to: parsed.to,
    openingBalance: parsed.openingBalance,
    closingBalance: parsed.rows.length ? parsed.rows[parsed.rows.length - 1].balance : parsed.openingBalance,
    rows,
    missing: rows.filter((r) => !r.match).length,
  }
}

export type ImportRow = {
  date: string
  amount: string
  type: 'income' | 'expense'
  title: string
  category: string
  tags?: string[]
  person?: string | null
  ref?: string | null
  particulars?: string | null
}

/** Creates transactions for the statement rows the user picked. */
export async function importStatementRows(payload: Payload, user: User, account: string, rows: ImportRow[]): Promise<string[]> {
  if (rows.length > 500) throw new APIError('Too many rows at once.', 400, undefined, true)
  await payload.findByID({ collection: 'accounts', id: account, depth: 0, user, overrideAccess: false })
  const ids: string[] = []
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new APIError(`Bad date "${r.date}".`, 400, undefined, true)
    const tx = await payload.create({
      collection: 'transactions',
      user,
      overrideAccess: false,
      data: {
        title: r.title,
        amount: r.amount,
        date: statementRowDate(r.date),
        type: r.type,
        category: r.category,
        account,
        tags: r.tags ?? [],
        person: r.person ?? null,
        note: r.particulars ? `From statement: ${r.particulars}` : 'From statement',
        source: 'import',
        externalRef: r.ref ?? null,
      } as any,
    })
    ids.push(String(tx.id))
  }
  return ids
}
