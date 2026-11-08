import type { TxEdit } from './transactions'

/** The values the edit form opened with. */
export type EditOriginal = {
  title: string
  note: string
  amount: string
  /** datetime-local value, YYYY-MM-DDTHH:mm */
  date: string
  category: string | null
  account: string | null
  person: string | null
  tags: string[]
  shares?: { person: string; amount: string }[]
  attachments?: string[]
}

type Submitted = {
  [K in keyof EditOriginal]?: K extends 'tags' | 'attachments' ? string[] : K extends 'shares' ? { person: string; amount: string }[] : string | null
}

const shareKey = (xs: { person: string; amount: string | number }[]) =>
  xs.map((x) => `${x.person}:${Math.round(Number(x.amount) * 100)}`).sort().join('|')

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

/**
 * Only what the user changed. Untouched fields are left alone, so a title edit can't
 * round an amount, drop a date's seconds or swap a category the form couldn't show.
 */
export function formToEdit(f: Submitted, o: EditOriginal): TxEdit {
  const out: TxEdit = {}
  if (f.title != null && f.title !== o.title) out.title = f.title
  if (f.note != null && f.note !== o.note) out.note = f.note
  if (f.amount != null && f.amount !== '' && Number(f.amount) !== Number(o.amount)) out.amount = Number(f.amount)
  if (f.date && f.date !== o.date) out.date = f.date.replace('T', ' ')
  if (f.category && f.category !== o.category) out.category = f.category
  if (f.account && f.account !== o.account) out.account = f.account
  const person = f.person || null
  if (f.person !== undefined && person !== o.person) out.person = person
  if (f.tags && !same(f.tags, o.tags)) out.tags = f.tags
  if (f.attachments && !same(f.attachments, o.attachments ?? [])) out.attachments = f.attachments
  if (f.shares && shareKey(f.shares) !== shareKey(o.shares ?? [])) out.shares = f.shares.map((x) => ({ person: x.person, amount: Number(x.amount) }))
  return out
}
