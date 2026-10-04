/**
 * Federal Bank account statement (the password-protected PDF from FedMobile / FedNet),
 * as text from unpdf. Each row is:
 *
 *   04-SEP-2026 04-SEP-2026 UPIOUT/661332409599
 *   /paytmqr64g507@ptys/Petro/5541
 *   TFR S36830842 300.00 270145.37 Cr
 *
 * date, value date, particulars (wrapped over lines), tran type + id, amount, balance.
 * Withdrawal vs deposit is read from the balance change, which the text can't tell apart.
 */

export type StatementRow = {
  /** Posting date as YYYY-MM-DD. */
  date: string
  particulars: string
  tranId: string
  amount: string
  type: 'income' | 'expense'
  balance: number
  /** UPI / bank reference found in the particulars. */
  ref: string | null
  /** Who was paid or paid you: a UPI ID or a name. */
  payee: string | null
  /** Short note from the particulars ("Coffee", "Diesel"), or a description for non-UPI rows. */
  hint: string | null
}

export type ParsedStatement = {
  bank: 'federal'
  accountNumber: string | null
  from: string | null
  to: string | null
  openingBalance: number | null
  rows: StatementRow[]
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const isoDate = (d: string) => {
  const [dd, mon, yyyy] = d.split('-')
  return `${yyyy}-${String(MONTHS.indexOf(mon) + 1).padStart(2, '0')}-${dd}`
}
const num = (s: string) => parseFloat(s.replace(/,/g, ''))
const signed = (amount: string, crdr: string) => (crdr === 'Dr' ? -num(amount) : num(amount))

const ROW_START = /^(\d{2}-[A-Z]{3}-\d{4}) (\d{2}-[A-Z]{3}-\d{4}) ?(.*)$/
const ROW_END = /^([A-Z]{2,6}) (\S+)(?: .*?)? ([\d,]+\.\d{2}) ([\d,]+\.\d{2}) (Cr|Dr)$/
const NOISE = /^(The Federal Bank Ltd\.|Ph:0484|GRAND TOTAL|Abbreviations Used)/

export function looksLikeFederalStatement(text: string): boolean {
  return /Federal Bank/i.test(text) && /Statement of Account/i.test(text)
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
// Truncated UPI notes that say nothing about the purchase.
const EMPTY_NOTES = new Set(['UPI', 'UP', 'U', 'PAY', 'PAYMENT', 'SENT', 'NA'])

/** Payee, reference and a title hint from the particulars. */
export function describe(particulars: string): Pick<StatementRow, 'ref' | 'payee' | 'hint'> {
  const upi = particulars.match(/^UPI ?(?:OUT|IN)\/(\d+)\/([^/]*)\/?([^/]*)?/i)
  if (upi) {
    const [, ref, payee, note] = upi
    const cleanNote = (note ?? '').replace(/\d+$/, '').trim()
    return {
      ref,
      payee: payee || null,
      hint: cleanNote.length >= 3 && !EMPTY_NOTES.has(cleanNote.toUpperCase()) ? titleCase(cleanNote) : null,
    }
  }
  if (/^SBINT/i.test(particulars)) return { ref: null, payee: null, hint: 'Savings account interest' }
  const neft = particulars.match(/^(?:NFT|NEFT)\/([^/]+)\/([^/]+)/i)
  if (neft) return { ref: neft[2], payee: neft[1].trim(), hint: `NEFT from ${titleCase(neft[1].trim())}` }
  const refund = particulars.match(/^MCDRefund\d*(.*)$/i)
  if (refund) return { ref: null, payee: refund[1] || null, hint: 'Card refund' }
  return { ref: null, payee: null, hint: null }
}

export function parseFederalStatement(pages: string[]): ParsedStatement {
  const lines = pages.join('\n').split('\n').map((l) => l.trim()).filter(Boolean)
  const text = lines.join('\n')

  const accountNumber = text.match(/Account Number : (\d+)/)?.[1] ?? null
  const period = text.match(/period (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/)
  const opening = text.match(/Opening Balance ([\d,]+\.\d{2}) (Cr|Dr)/)
  const openingBalance = opening ? signed(opening[1], opening[2]) : null

  const rows: StatementRow[] = []
  let prev = openingBalance
  let current: { date: string; parts: string[] } | null = null

  for (const line of lines) {
    if (NOISE.test(line)) continue
    const start = line.match(ROW_START)
    if (start) {
      current = { date: isoDate(start[1]), parts: start[3] ? [start[3]] : [] }
      continue
    }
    if (!current) continue
    const end = line.match(ROW_END)
    if (!end) {
      current.parts.push(line)
      continue
    }
    const balance = signed(end[4], end[5])
    const amount = num(end[3])
    // Without an opening balance the first row's direction is a guess; later rows use the change.
    const type: StatementRow['type'] = prev == null ? 'expense' : balance > prev ? 'income' : 'expense'
    const particulars = current.parts.join('')
    rows.push({
      date: current.date,
      particulars,
      tranId: end[2],
      amount: amount.toFixed(2),
      type,
      balance,
      ...describe(particulars),
    })
    prev = balance
    current = null
  }

  return {
    bank: 'federal',
    accountNumber,
    from: period?.[1] ?? null,
    to: period?.[2] ?? null,
    openingBalance,
    rows,
  }
}
