import type { Payload } from 'payload'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function r(n: number) { return Math.round(n * 100) / 100 }

export type PersonActivity = {
  id: string
  name: string
  email: string | null
  phone: string | null
  description: string | null
  balance: number
  totalAmount: number
  totalTransactionCount: number
  expenseAmount: number
  expenseTransactionCount: number
  incomeAmount: number
  incomeTransactionCount: number
  averagePerTransaction: number
  highestTransaction: number
  lowestTransaction: number
  lastTransactionAt: string | null
}

export type MonthlyPeopleResult = {
  data: PersonActivity[]
  meta: {
    month: number
    year: number
    monthName: string
    totalExpenses: number
    totalIncome: number
  }
}

export async function calculateMonthlyPeople(
  payload: Payload,
  userId: string | number,
  month: number,
  year: number,
  timezone: string,
): Promise<MonthlyPeopleResult> {
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })

  const startUTC = new Date(Date.UTC(year, month - 1, 1))
  startUTC.setDate(startUTC.getDate() - 1)
  const endUTC = new Date(Date.UTC(year, month, 1))
  endUTC.setDate(endUTC.getDate() + 1)

  const [peopleResult, monthlyTxResult, allTimeTxResult] = await Promise.all([
    payload.find({
      collection: 'people',
      where: { and: [{ user: { equals: userId } }, { isActive: { equals: true } }] },
      limit: 500,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { isActive: { equals: true } },
          { type: { not_equals: 'transfer' } },
          { date: { greater_than_equal: startUTC.toISOString() } },
          { date: { less_than: endUTC.toISOString() } },
        ],
      },
      limit: 10000,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { user: { equals: userId } },
          { isActive: { equals: true } },
          { type: { not_equals: 'transfer' } },
        ],
      },
      limit: 0,
      pagination: false,
      depth: 0,
    }),
  ])

  // All-time balance per person
  const allTimeBalance: Record<string, number> = {}
  const lastTxAt: Record<string, string> = {}

  for (const tx of allTimeTxResult.docs) {
    const personId =
      typeof tx.person === 'string' ? tx.person : (tx.person as any)?.id
    if (!personId) continue

    const amount = parseFloat((tx.amount as string) || '0')
    if (!allTimeBalance[personId]) allTimeBalance[personId] = 0
    if (tx.type === 'income') allTimeBalance[personId] += amount
    else if (tx.type === 'expense') allTimeBalance[personId] -= amount

    const date = tx.date as string
    if (date && (!lastTxAt[personId] || date > lastTxAt[personId])) {
      lastTxAt[personId] = date
    }
  }

  // Monthly stats per person
  type MonthStats = {
    expenseSum: number; expenseCount: number
    incomeSum: number; incomeCount: number
    hi: number; lo: number
  }
  const monthly: Record<string, MonthStats> = {}

  for (const tx of monthlyTxResult.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    const [y, m] = localDate.split('-').map(Number)
    if (y !== year || m !== month) continue

    const personId =
      typeof tx.person === 'string' ? tx.person : (tx.person as any)?.id
    if (!personId) continue

    const amount = parseFloat((tx.amount as string) || '0')
    if (!monthly[personId]) {
      monthly[personId] = { expenseSum: 0, expenseCount: 0, incomeSum: 0, incomeCount: 0, hi: 0, lo: Infinity }
    }
    const s = monthly[personId]
    if (tx.type === 'expense') { s.expenseSum += amount; s.expenseCount++ }
    else if (tx.type === 'income') { s.incomeSum += amount; s.incomeCount++ }
    if (amount > s.hi) s.hi = amount
    if (amount < s.lo) s.lo = amount
  }

  const data: PersonActivity[] = peopleResult.docs.map((person) => {
    const stats = monthly[person.id as string]
    const totalCount = stats ? stats.expenseCount + stats.incomeCount : 0
    const totalSum = stats ? stats.expenseSum + stats.incomeSum : 0

    return {
      id: person.id as string,
      name: (person as any).name,
      email: (person as any).email ?? null,
      phone: (person as any).phone ?? null,
      description: (person as any).description ?? null,
      balance: r(allTimeBalance[person.id as string] ?? 0),
      totalAmount: stats ? r(stats.incomeSum - stats.expenseSum) : 0,
      totalTransactionCount: totalCount,
      expenseAmount: stats ? r(stats.expenseSum) : 0,
      expenseTransactionCount: stats?.expenseCount ?? 0,
      incomeAmount: stats ? r(stats.incomeSum) : 0,
      incomeTransactionCount: stats?.incomeCount ?? 0,
      averagePerTransaction: totalCount > 0 ? r(totalSum / totalCount) : 0,
      highestTransaction: stats ? r(stats.hi) : 0,
      lowestTransaction: stats && stats.lo !== Infinity ? r(stats.lo) : 0,
      lastTransactionAt: lastTxAt[person.id as string] ?? null,
    }
  })

  data.sort((a, b) => b.totalTransactionCount - a.totalTransactionCount || Math.abs(b.totalAmount) - Math.abs(a.totalAmount))

  const totalExpenses = r(data.reduce((s, p) => s + p.expenseAmount, 0))
  const totalIncome = r(data.reduce((s, p) => s + p.incomeAmount, 0))

  return {
    data,
    meta: { month, year, monthName: MONTH_NAMES[month - 1], totalExpenses, totalIncome },
  }
}
