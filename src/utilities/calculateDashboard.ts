import type { Payload } from 'payload'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type DashboardData = {
  totalBalance: number
  balanceChangePercent: number | null
  monthlyPulse: {
    income: number
    expenses: number
    surplus: number
    month: number
    year: number
    monthName: string
  }
}

export async function calculateDashboard(
  payload: Payload,
  userId: string | number,
  timezone: string,
): Promise<DashboardData> {
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  const todayLocal = localFmt.format(new Date())
  const [year, month] = todayLocal.split('-').map(Number)

  const lastMonth = month === 1 ? 12 : month - 1
  const lastMonthYear = month === 1 ? year - 1 : year

  // Run account balance sum and transaction fetch in parallel
  const startUTC = new Date(Date.UTC(lastMonthYear, lastMonth - 1, 1))
  startUTC.setDate(startUTC.getDate() - 1)
  const endUTC = new Date(Date.UTC(year, month, 1))
  endUTC.setDate(endUTC.getDate() + 1)

  const [accounts, txResult] = await Promise.all([
    payload.find({
      collection: 'accounts',
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
          { date: { greater_than_equal: startUTC.toISOString() } },
          { date: { less_than: endUTC.toISOString() } },
        ],
      },
      limit: 20000,
      depth: 0,
    }),
  ])

  const totalBalance = accounts.docs.reduce(
    (sum, acc) => sum + (Number((acc as Record<string, unknown>).balance) || 0),
    0,
  )

  let thisIncome = 0, thisExpenses = 0
  let lastIncome = 0, lastExpenses = 0

  for (const tx of txResult.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    const [y, m] = localDate.split('-').map(Number)
    const amount = parseFloat((tx.amount as string) || '0')

    if (y === year && m === month) {
      if (tx.type === 'income') thisIncome += amount
      else if (tx.type === 'expense') thisExpenses += amount
    } else if (y === lastMonthYear && m === lastMonth) {
      if (tx.type === 'income') lastIncome += amount
      else if (tx.type === 'expense') lastExpenses += amount
    }
  }

  const thisSurplus = thisIncome - thisExpenses
  const lastSurplus = lastIncome - lastExpenses
  const balanceChangePercent =
    lastSurplus !== 0
      ? Math.round(((thisSurplus - lastSurplus) / Math.abs(lastSurplus)) * 1000) / 10
      : null

  return {
    totalBalance: Math.round(totalBalance * 100) / 100,
    balanceChangePercent,
    monthlyPulse: {
      income: Math.round(thisIncome * 100) / 100,
      expenses: Math.round(thisExpenses * 100) / 100,
      surplus: Math.round(thisSurplus * 100) / 100,
      month,
      year,
      monthName: MONTH_NAMES[month - 1],
    },
  }
}
