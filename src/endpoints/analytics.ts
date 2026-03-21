import type { PayloadHandler } from 'payload'
import { calculateDashboard } from '../utilities/calculateDashboard'
import { calculateMonthlyCategories } from '../utilities/calculateMonthlyCategories'
import { calculateMonthlyTags } from '../utilities/calculateMonthlyTags'
import { calculateMonthlyPeople } from '../utilities/calculateMonthlyPeople'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

async function getUserTimezone(req: Parameters<PayloadHandler>[0]): Promise<string> {
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

/**
 * GET /api/analytics/weekly-expenses
 * Returns the last 7 days of expenses grouped by day, in the user's timezone.
 *
 * Response:
 *   days: { sun, mon, tue, wed, thu, fri, sat }  — totals keyed by day name
 *   dailyData: [{ date, day, total }]             — ordered oldest → today
 *   timezone: string
 */
export const weeklyExpensesHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const timezone = await getUserTimezone(req)
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }) // → YYYY-MM-DD

  const now = new Date()
  const todayLocal = localFmt.format(now)

  // Fetch with a buffer on each side to cover any timezone offset edge cases
  const windowStart = new Date(todayLocal + 'T00:00:00')
  windowStart.setDate(windowStart.getDate() - 7)
  const windowEnd = new Date(todayLocal + 'T00:00:00')
  windowEnd.setDate(windowEnd.getDate() + 2)

  const result = await req.payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: req.user.id } },
        { type: { equals: 'expense' } },
        { isActive: { equals: true } },
        { date: { greater_than_equal: windowStart.toISOString() } },
        { date: { less_than: windowEnd.toISOString() } },
      ],
    },
    limit: 5000,
    depth: 0,
  })

  // Sum expenses per local date
  const byDate: Record<string, number> = {}
  for (const tx of result.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    byDate[localDate] = (byDate[localDate] ?? 0) + parseFloat((tx.amount as string) || '0')
  }

  // Build last-7-days array (oldest → today)
  const days: Record<string, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 }
  const dailyData: { date: string; day: string; total: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayLocal + 'T00:00:00')
    d.setDate(d.getDate() - i)
    const dateStr = localFmt.format(d)
    const dayName = DAY_NAMES[d.getDay()]
    const total = Math.round((byDate[dateStr] ?? 0) * 100) / 100
    days[dayName] = total
    dailyData.push({ date: dateStr, day: dayName, total })
  }

  return Response.json({ days, dailyData, timezone })
}

/**
 * GET /api/analytics/monthly-calendar?month=3&year=2026
 * Returns daily income/expense/transfer/balance for every day of the month.
 *
 * Response:
 *   data: [{ date, income, expenses, transfers, balance, transactionCount, ... }]
 *   meta: { month, year, monthName, timezone, totalIncome, totalExpenses, totalTransfers, balance }
 */
export const monthlyCalendarHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const url = new URL(req.url)
  const now = new Date()
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()))

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
    return Response.json({ errors: [{ message: 'Invalid month or year' }] }, { status: 400 })
  }

  const timezone = await getUserTimezone(req)
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })

  // UTC query range with ±1 day buffer to account for any timezone offset
  const startUTC = new Date(Date.UTC(year, month - 1, 1))
  startUTC.setDate(startUTC.getDate() - 1)
  const endUTC = new Date(Date.UTC(year, month, 1))
  endUTC.setDate(endUTC.getDate() + 1)

  const result = await req.payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: req.user.id } },
        { isActive: { equals: true } },
        { date: { greater_than_equal: startUTC.toISOString() } },
        { date: { less_than: endUTC.toISOString() } },
      ],
    },
    limit: 10000,
    depth: 0,
  })

  type DayData = {
    income: number; expenses: number; transfers: number; balance: number
    transactionCount: number; incomeCount: number; expenseCount: number; transferCount: number
  }
  const byDate: Record<string, DayData> = {}

  for (const tx of result.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    const [y, m] = localDate.split('-').map(Number)
    if (y !== year || m !== month) continue // discard buffer-zone transactions

    if (!byDate[localDate]) {
      byDate[localDate] = {
        income: 0, expenses: 0, transfers: 0, balance: 0,
        transactionCount: 0, incomeCount: 0, expenseCount: 0, transferCount: 0,
      }
    }
    const d = byDate[localDate]
    const amount = parseFloat((tx.amount as string) || '0')
    d.transactionCount++
    if (tx.type === 'income') { d.income += amount; d.incomeCount++ }
    else if (tx.type === 'expense') { d.expenses += amount; d.expenseCount++ }
    else if (tx.type === 'transfer') { d.transfers += amount; d.transferCount++ }
    d.balance = d.income - d.expenses
  }

  // Fill every day of the month (zeros for days with no transactions)
  const daysInMonth = new Date(year, month, 0).getDate()
  let totalIncome = 0, totalExpenses = 0, totalTransfers = 0

  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = byDate[dateStr] ?? {
      income: 0, expenses: 0, transfers: 0, balance: 0,
      transactionCount: 0, incomeCount: 0, expenseCount: 0, transferCount: 0,
    }
    totalIncome += d.income
    totalExpenses += d.expenses
    totalTransfers += d.transfers
    return {
      date: dateStr,
      income: Math.round(d.income * 100) / 100,
      expenses: Math.round(d.expenses * 100) / 100,
      transfers: Math.round(d.transfers * 100) / 100,
      balance: Math.round(d.balance * 100) / 100,
      transactionCount: d.transactionCount,
      incomeTransactionCount: d.incomeCount,
      expenseTransactionCount: d.expenseCount,
      transferTransactionCount: d.transferCount,
    }
  })

  return Response.json({
    data,
    meta: {
      month,
      year,
      monthName: MONTH_NAMES[month - 1],
      timezone,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalTransfers: Math.round(totalTransfers * 100) / 100,
      balance: Math.round((totalIncome - totalExpenses) * 100) / 100,
    },
  })
}

/**
 * GET /api/analytics/dashboard
 * Home screen summary: total balance, % change vs last month, and current month pulse.
 */
export const dashboardHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }
  const timezone = await getUserTimezone(req)
  const data = await calculateDashboard(req.payload, req.user.id, timezone)
  return Response.json(data)
}

/**
 * GET /api/analytics/monthly-categories?month=3&year=2026
 * Returns expense spending grouped by category, with parent rollup.
 */
export const monthlyCategoriesHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const url = new URL(req.url)
  const now = new Date()
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()))

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
    return Response.json({ errors: [{ message: 'Invalid month or year' }] }, { status: 400 })
  }

  const timezone = await getUserTimezone(req)
  const data = await calculateMonthlyCategories(req.payload, req.user.id, month, year, timezone)
  return Response.json(data)
}

/**
 * GET /api/analytics/monthly-tags?month=3&year=2026
 * Returns transaction activity grouped by tag, split by type (expense/income/transfer).
 */
export const monthlyTagsHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const url = new URL(req.url)
  const now = new Date()
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()))

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
    return Response.json({ errors: [{ message: 'Invalid month or year' }] }, { status: 400 })
  }

  const timezone = await getUserTimezone(req)
  const data = await calculateMonthlyTags(req.payload, req.user.id, month, year, timezone)
  return Response.json(data)
}

/**
 * GET /api/analytics/monthly-people?month=3&year=2026
 * Returns monthly transaction activity per person plus all-time balance.
 */
export const monthlyPeopleHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const url = new URL(req.url)
  const now = new Date()
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()))

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
    return Response.json({ errors: [{ message: 'Invalid month or year' }] }, { status: 400 })
  }

  const timezone = await getUserTimezone(req)
  const data = await calculateMonthlyPeople(req.payload, req.user.id, month, year, timezone)
  return Response.json(data)
}
