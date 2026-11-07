import type { Payload } from 'payload'
import { toLocalWhere } from '../search/searchSummary'

const HEADER = ['Date', 'Time', 'Title', 'Type', 'Amount', 'Category', 'Account', 'To account', 'Person', 'Tags', 'Note', 'Source', 'Reference']

/**
 * One CSV cell. Quotes when needed (comma, quote, newline). A text starting with = + - @
 * gets a leading apostrophe so a spreadsheet shows it instead of running it as a formula.
 */
export function csvCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  let s = String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const name = (v: unknown) => (v && typeof v === 'object' ? String((v as { name?: unknown }).name ?? '') : '')

/**
 * The user's transactions matching `where` (the History list's GraphQL-shaped where) as
 * CSV, newest first, dates and times in `timeZone`. Always scoped to the user.
 */
export async function transactionsCsv(
  payload: Payload,
  userId: string,
  where: Record<string, unknown> | null | undefined,
  timeZone: string,
): Promise<string> {
  const zone = !timeZone || timeZone === 'UTC' ? 'Asia/Kolkata' : timeZone
  const res = await payload.find({
    collection: 'transactions',
    where: { and: [{ user: { equals: userId } }, ...(where && Object.keys(where).length ? [toLocalWhere(where)] : [])] },
    sort: '-date',
    pagination: false,
    depth: 1,
  })
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const lines = [HEADER.join(',')]
  for (const t of res.docs) {
    const d = new Date(t.date as string)
    const amount = Number(t.amount)
    lines.push(
      [
        day.format(d),
        time.format(d),
        t.title,
        t.type,
        Number.isFinite(amount) ? amount.toFixed(2) : t.amount,
        name(t.category),
        name(t.account),
        name(t.toAccount),
        name(t.person),
        Array.isArray(t.tags) ? t.tags.map(name).filter(Boolean).join('; ') : '',
        t.note,
        t.source,
        t.externalRef,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return lines.join('\r\n') + '\r\n'
}
