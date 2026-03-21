import type { Payload } from 'payload'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function r(n: number) { return Math.round(n * 100) / 100 }

export type TagActivity = {
  id: string
  name: string
  icon: string | null
  color: string | null
  bgColor: string | null
  description: string | null
  isSystem: boolean
  totalAmount: number
  totalTransactionCount: number
  expenseAmount: number
  expenseTransactionCount: number
  incomeAmount: number
  incomeTransactionCount: number
  transferAmount: number
  transferTransactionCount: number
  averagePerTransaction: number
  highestTransaction: number
  lowestTransaction: number
}

export type MonthlyTagsResult = {
  data: TagActivity[]
  meta: {
    month: number
    year: number
    monthName: string
    totalExpenses: number
    totalIncome: number
    totalTransfers: number
  }
}

export async function calculateMonthlyTags(
  payload: Payload,
  userId: string | number,
  month: number,
  year: number,
  timezone: string,
): Promise<MonthlyTagsResult> {
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })

  const startUTC = new Date(Date.UTC(year, month - 1, 1))
  startUTC.setDate(startUTC.getDate() - 1)
  const endUTC = new Date(Date.UTC(year, month, 1))
  endUTC.setDate(endUTC.getDate() + 1)

  // Get system user IDs first, then fetch in parallel
  const sysResult = await payload.find({
    collection: 'users',
    where: { role: { equals: 'system' } },
    limit: 100,
    depth: 0,
  })
  const sysIds = sysResult.docs.map((u) => u.id as string)
  const sysIdSet = new Set(sysIds)

  const ownerOr = [
    { user: { equals: userId } },
    ...(sysIds.length ? [{ user: { in: sysIds } }] : []),
  ]

  const [tagResult, txResult] = await Promise.all([
    payload.find({
      collection: 'tags',
      where: { and: [{ isActive: { equals: true } }, { or: ownerOr }] },
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
      limit: 10000,
      depth: 0,
    }),
  ])

  type Stats = {
    expenseSum: number; expenseCount: number
    incomeSum: number; incomeCount: number
    transferSum: number; transferCount: number
    hi: number; lo: number
  }
  const byTag: Record<string, Stats> = {}

  for (const tx of txResult.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    const [y, m] = localDate.split('-').map(Number)
    if (y !== year || m !== month) continue

    const tagIds = Array.isArray(tx.tags)
      ? (tx.tags as any[]).map((t) => (typeof t === 'string' ? t : t?.id)).filter(Boolean)
      : []
    if (!tagIds.length) continue

    const amount = parseFloat((tx.amount as string) || '0')

    for (const tagId of tagIds) {
      if (!byTag[tagId]) {
        byTag[tagId] = {
          expenseSum: 0, expenseCount: 0,
          incomeSum: 0, incomeCount: 0,
          transferSum: 0, transferCount: 0,
          hi: 0, lo: Infinity,
        }
      }
      const s = byTag[tagId]
      if (tx.type === 'expense') { s.expenseSum += amount; s.expenseCount++ }
      else if (tx.type === 'income') { s.incomeSum += amount; s.incomeCount++ }
      else if (tx.type === 'transfer') { s.transferSum += amount; s.transferCount++ }
      if (amount > s.hi) s.hi = amount
      if (amount < s.lo) s.lo = amount
    }
  }

  const data: TagActivity[] = tagResult.docs.map((tag) => {
    const stats = byTag[tag.id as string]
    const ownerId =
      typeof (tag as any).user === 'string' ? (tag as any).user : (tag as any).user?.id

    const totalCount = stats
      ? stats.expenseCount + stats.incomeCount + stats.transferCount
      : 0
    const totalSum = stats ? stats.expenseSum + stats.incomeSum + stats.transferSum : 0

    return {
      id: tag.id as string,
      name: (tag as any).name,
      icon: (tag as any).icon ?? null,
      color: (tag as any).color ?? null,
      bgColor: (tag as any).bgColor ?? null,
      description: (tag as any).description ?? null,
      isSystem: sysIdSet.has(ownerId),
      totalAmount: stats ? r(stats.incomeSum - stats.expenseSum) : 0,
      totalTransactionCount: totalCount,
      expenseAmount: stats ? r(stats.expenseSum) : 0,
      expenseTransactionCount: stats?.expenseCount ?? 0,
      incomeAmount: stats ? r(stats.incomeSum) : 0,
      incomeTransactionCount: stats?.incomeCount ?? 0,
      transferAmount: stats ? r(stats.transferSum) : 0,
      transferTransactionCount: stats?.transferCount ?? 0,
      averagePerTransaction: totalCount > 0 ? r(totalSum / totalCount) : 0,
      highestTransaction: stats ? r(stats.hi) : 0,
      lowestTransaction: stats && stats.lo !== Infinity ? r(stats.lo) : 0,
    }
  })

  data.sort((a, b) => b.totalTransactionCount - a.totalTransactionCount)

  const totalExpenses = r(data.reduce((s, t) => s + t.expenseAmount, 0))
  const totalIncome = r(data.reduce((s, t) => s + t.incomeAmount, 0))
  const totalTransfers = r(data.reduce((s, t) => s + t.transferAmount, 0))

  return {
    data,
    meta: { month, year, monthName: MONTH_NAMES[month - 1], totalExpenses, totalIncome, totalTransfers },
  }
}
