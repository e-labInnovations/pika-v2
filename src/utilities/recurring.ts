import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/**
 * Monthly payments (rent, mess, recharges, salary) found in the user's history, and the
 * reminders they track. A detected pattern becomes a monthly Reminder when the user
 * tracks it; "not recurring" stores an archived one so it isn't suggested again.
 */

export type RecurringSuggestion = {
  key: string
  title: string
  type: 'income' | 'expense'
  amount: string
  /** Usual day of the month. */
  day: number
  category: string | null
  account: string | null
  occurrences: number
  lastDate: string
  nextDue: string
}

export type RecurringDue = {
  reminder: string
  title: string
  type: string
  amount: string | null
  nextDue: string
  /** `missing`: the due date passed with no matching transaction; `soon`: due within a week. */
  status: 'missing' | 'soon'
  category: string | null
  account: string | null
}

const DAY = 86_400_000
const LOOKBACK_DAYS = 210
const MIN_MONTHS = 3
/** How far from the due date a transaction still counts as this month's payment. */
const MATCH_WINDOW_DAYS = 10
const SOON_DAYS = 7
const MISSING_AFTER_DAYS = 3

const idOf = (v: unknown): string | null =>
  v == null ? null : String(typeof v === 'object' ? (v as { id: string }).id : v)

const IST_MS = 330 * 60_000
const istDate = (iso: string) => new Date(Date.parse(iso) + IST_MS)

/** Title without amounts, dates and noise: "Rent - Oct 2026" and "Rent (Sep)" group together. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

const AMOUNT_TOLERANCE = 0.4
const DAY_SPREAD = 6

/**
 * The usual day of the month, or null when the days are too spread out. Wraps around
 * the month end: paid on the 30th, 31st and 3rd is "around the 31st", not the 30th-3rd.
 */
export function usualDay(days: number[]): number | null {
  const wraps = days.some((d) => d <= DAY_SPREAD) && days.some((d) => d >= 31 - DAY_SPREAD)
  const shifted = wraps ? days.map((d) => (d <= DAY_SPREAD ? d + 30 : d)) : days
  const mid = Math.round(median(shifted))
  if (shifted.some((d) => Math.abs(d - mid) > DAY_SPREAD)) return null
  return mid > 31 ? mid - 30 : mid
}

/** "Salary - ThoughtSpot (Sep 2026)" → "Salary - ThoughtSpot": a reminder title for every month. */
export function reminderTitle(title: string): string {
  return title
    .replace(/\s*[([]?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}[)\]]?/gi, '')
    .replace(/\s*[-–:]\s*$/, '')
    .trim() || title
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** The `day` of the month after `from` (clamped to the month's length), noon IST, as ISO. */
export function nextMonthly(from: Date, day: number): string {
  const y = from.getUTCFullYear()
  const m = from.getUTCMonth() + 1
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(day, last), 6, 30)).toISOString()
}

type Tx = { id: string; title: string; type: string; amount: number; date: string; category: string | null; account: string | null }

/** Groups of transactions that happened about monthly, in distinct months, for similar amounts. */
export function detectMonthly(txs: Tx[], now = new Date()): RecurringSuggestion[] {
  const groups = new Map<string, Tx[]>()
  for (const t of txs) {
    if (t.type !== 'expense' && t.type !== 'income') continue
    const k = titleKey(t.title)
    if (k.length < 3) continue
    const key = `${t.type}|${t.category ?? ''}|${k}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  const out: RecurringSuggestion[] = []
  for (const [key, list] of groups) {
    // One per cycle: payments within half a month of each other are one cycle, and the
    // largest counts (a small top-up isn't the bill). Cycles, not calendar months, so a
    // salary paid on the 3rd instead of the 31st doesn't leave a month empty.
    const cycles: Tx[] = []
    for (const t of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
      const cur = cycles[cycles.length - 1]
      if (cur && Date.parse(t.date) - Date.parse(cur.date) < 15 * DAY) {
        if (t.amount > cur.amount) cycles[cycles.length - 1] = t
      } else cycles.push(t)
    }
    // Many payments per cycle is a habit (coffee, food orders), not a bill.
    if (list.length > cycles.length * 1.5) continue
    // The latest unbroken run of monthly cycles; older history may have gaps.
    let start = cycles.length - 1
    while (start > 0) {
      const gap = (Date.parse(cycles[start].date) - Date.parse(cycles[start - 1].date)) / DAY
      if (gap < 20 || gap > 45) break
      start--
    }
    const monthly = cycles.slice(start)
    if (monthly.length < MIN_MONTHS) continue

    const amounts = monthly.map((t) => t.amount)
    const typical = median(amounts)
    // Salaries and wallet credits vary with working days; a bill that doubles isn't the same bill.
    if (typical <= 0 || amounts.some((a) => Math.abs(a - typical) / typical > AMOUNT_TOLERANCE)) continue
    const day = usualDay(monthly.map((t) => istDate(t.date).getUTCDate()))
    if (day == null) continue
    const last = monthly[monthly.length - 1]
    // Stopped: nothing for two cycles.
    if (now.getTime() - Date.parse(last.date) > 62 * DAY) continue
    out.push({
      key,
      title: reminderTitle(last.title),
      type: last.type as 'income' | 'expense',
      amount: typical.toFixed(2),
      day,
      category: last.category,
      account: last.account,
      occurrences: monthly.length,
      lastDate: last.date,
      nextDue: nextMonthly(istDate(last.date), day),
    })
  }
  return out.sort((a, b) => a.nextDue.localeCompare(b.nextDue))
}

async function recentTransactions(payload: Payload, user: User): Promise<Tx[]> {
  const res = await payload.find({
    collection: 'transactions',
    user,
    overrideAccess: false,
    where: { date: { greater_than_equal: new Date(Date.now() - LOOKBACK_DAYS * DAY).toISOString() } },
    pagination: false,
    depth: 0,
    select: { title: true, type: true, amount: true, date: true, category: true, account: true },
  })
  return res.docs.map((t) => ({
    id: String(t.id),
    title: t.title as string,
    type: t.type as string,
    amount: parseFloat(t.amount as string) || 0,
    date: t.date as string,
    category: idOf(t.category),
    account: idOf(t.account),
  }))
}

/**
 * Detected patterns not yet tracked or dismissed, and tracked reminders that are due
 * soon or look missed. Tracked monthly reminders whose payment has appeared are moved
 * on to the next month here (no scheduler needed).
 */
export async function recurringOverview(
  payload: Payload,
  user: User,
  now = new Date(),
): Promise<{ suggestions: RecurringSuggestion[]; due: RecurringDue[] }> {
  const [txs, remindersRes] = await Promise.all([
    recentTransactions(payload, user),
    payload.find({ collection: 'reminders', user, overrideAccess: false, pagination: false, depth: 0 }),
  ])
  const reminders = remindersRes.docs

  const known = new Set(reminders.map((r) => `${r.type}|${idOf(r.category) ?? ''}|${titleKey(r.title as string)}`))
  const suggestions = detectMonthly(txs, now).filter((s) => !known.has(s.key))

  const due: RecurringDue[] = []
  for (const r of reminders) {
    if (r.archived || !r.isRecurring || r.recurrenceType !== 'monthly' || !r.nextDueDate) continue
    let next = r.nextDueDate as string
    const key = titleKey(r.title as string)
    const day = istDate(next).getUTCDate()
    const paid = (dueIso: string) =>
      txs.find(
        (t) =>
          t.type === r.type &&
          (idOf(r.category) ? t.category === idOf(r.category) : true) &&
          titleKey(t.title) === key &&
          Math.abs(Date.parse(t.date) - Date.parse(dueIso)) <= MATCH_WINDOW_DAYS * DAY,
      )
    // Advance past every month already paid.
    const completed: string[] = []
    for (let hit = paid(next); hit; hit = paid(next)) {
      completed.push(hit.date)
      next = nextMonthly(istDate(next), day)
    }
    if (completed.length) {
      await payload.update({
        collection: 'reminders',
        id: r.id,
        user,
        overrideAccess: false,
        data: {
          nextDueDate: next,
          lastTriggeredAt: completed[completed.length - 1],
          completedDates: [...((r.completedDates as { date: string }[] | null) ?? []), ...completed.map((date) => ({ date }))],
        },
      })
    }
    const until = Date.parse(next) - now.getTime()
    const status = until < -MISSING_AFTER_DAYS * DAY ? 'missing' : until <= SOON_DAYS * DAY ? 'soon' : null
    if (status) {
      due.push({
        reminder: String(r.id),
        title: r.title as string,
        type: r.type as string,
        amount: (r.amount as string | null) ?? null,
        nextDue: next,
        status,
        category: idOf(r.category),
        account: idOf(r.account),
      })
    }
  }
  return { suggestions, due: due.sort((a, b) => a.nextDue.localeCompare(b.nextDue)) }
}
