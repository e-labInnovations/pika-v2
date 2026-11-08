import { localInputValue } from './format'

export type Prefill = {
  type: 'expense' | 'income' | 'transfer'
  title: string
  amount: string
  /** datetime-local value, or null to keep "now". */
  date: string | null
  category: string | null
  account: string | null
  toAccount: string | null
  person: string | null
  tags: string[]
  shares: { person: string; amount: string }[]
  note: string
}

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

/** The AI's resolved transaction (docs or ids) → values for the Add form. */
export function toPrefill(d: Record<string, unknown>, tz: string): Prefill {
  const type = d.type === 'income' || d.type === 'transfer' ? d.type : 'expense'
  const at = typeof d.date === 'string' ? new Date(d.date) : null
  const amount = Number(d.amount)
  return {
    type,
    title: typeof d.title === 'string' ? d.title : '',
    amount: Number.isFinite(amount) && amount > 0 ? String(amount) : '',
    date: at && !Number.isNaN(at.getTime()) ? localInputValue(at.toISOString(), tz) : null,
    category: idOf(d.category),
    account: idOf(d.account),
    toAccount: idOf(d.toAccount),
    person: idOf(d.person),
    tags: (Array.isArray(d.tags) ? d.tags : []).map(idOf).filter((x): x is string => !!x),
    shares: (Array.isArray(d.shares) ? d.shares : [])
      .map((s) => ({ person: idOf((s as { person?: unknown }).person) ?? '', amount: Number((s as { amount?: unknown }).amount).toFixed(2) }))
      .filter((s) => s.person && Number(s.amount) > 0),
    note: typeof d.note === 'string' ? d.note : '',
  }
}
