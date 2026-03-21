import type { Payload } from 'payload'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function r(n: number) { return Math.round(n * 100) / 100 }

export type CategoryActivity = {
  id: string
  name: string
  icon: string | null
  color: string | null
  bgColor: string | null
  description: string | null
  isSystem: boolean
  isParent: boolean
  parentId: string | null
  amount: number
  transactionCount: number
  averagePerTransaction: number
  highestTransaction: number
  lowestTransaction: number
}

export type MonthlyCategoriesResult = {
  data: CategoryActivity[]
  meta: { month: number; year: number; monthName: string; totalExpenses: number }
}

export async function calculateMonthlyCategories(
  payload: Payload,
  userId: string | number,
  month: number,
  year: number,
  timezone: string,
): Promise<MonthlyCategoriesResult> {
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

  const [catResult, txResult] = await Promise.all([
    payload.find({
      collection: 'categories',
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
          { type: { equals: 'expense' } },
          { date: { greater_than_equal: startUTC.toISOString() } },
          { date: { less_than: endUTC.toISOString() } },
        ],
      },
      limit: 10000,
      depth: 0,
    }),
  ])

  type Stats = { sum: number; count: number; hi: number; lo: number }
  const byCat: Record<string, Stats> = {}

  for (const tx of txResult.docs) {
    const localDate = localFmt.format(new Date(tx.date as string))
    const [y, m] = localDate.split('-').map(Number)
    if (y !== year || m !== month) continue

    const catId = (
      typeof tx.category === 'string' ? tx.category : (tx.category as any)?.id
    ) as string | undefined
    if (!catId) continue

    const amount = parseFloat((tx.amount as string) || '0')
    if (!byCat[catId]) byCat[catId] = { sum: 0, count: 0, hi: 0, lo: Infinity }
    const s = byCat[catId]
    s.sum += amount
    s.count++
    if (amount > s.hi) s.hi = amount
    if (amount < s.lo) s.lo = amount
  }

  const dataMap: Record<string, CategoryActivity> = {}
  for (const cat of catResult.docs) {
    const stats = byCat[cat.id]
    const ownerId =
      typeof (cat as any).user === 'string' ? (cat as any).user : (cat as any).user?.id
    const parentId =
      typeof (cat as any).parent === 'string'
        ? (cat as any).parent
        : ((cat as any).parent?.id ?? null)

    dataMap[cat.id as string] = {
      id: cat.id as string,
      name: (cat as any).name,
      icon: (cat as any).icon ?? null,
      color: (cat as any).color ?? null,
      bgColor: (cat as any).bgColor ?? null,
      description: (cat as any).description ?? null,
      isSystem: sysIdSet.has(ownerId),
      isParent: !parentId,
      parentId,
      amount: stats ? r(stats.sum) : 0,
      transactionCount: stats?.count ?? 0,
      averagePerTransaction: stats && stats.count > 0 ? r(stats.sum / stats.count) : 0,
      highestTransaction: stats ? r(stats.hi) : 0,
      lowestTransaction: stats && stats.lo !== Infinity ? r(stats.lo) : 0,
    }
  }

  // Roll child amounts up into parent categories
  for (const cat of Object.values(dataMap)) {
    if (cat.parentId && dataMap[cat.parentId]) {
      const parent = dataMap[cat.parentId]
      parent.amount = r(parent.amount + cat.amount)
      parent.transactionCount += cat.transactionCount
      parent.averagePerTransaction =
        parent.transactionCount > 0 ? r(parent.amount / parent.transactionCount) : 0
      if (cat.highestTransaction > parent.highestTransaction)
        parent.highestTransaction = cat.highestTransaction
      if (
        cat.lowestTransaction > 0 &&
        (parent.lowestTransaction === 0 || cat.lowestTransaction < parent.lowestTransaction)
      )
        parent.lowestTransaction = cat.lowestTransaction
    }
  }

  const data = Object.values(dataMap).sort((a, b) => b.amount - a.amount)
  const totalExpenses = r(Object.values(byCat).reduce((s, c) => s + c.sum, 0))

  return {
    data,
    meta: { month, year, monthName: MONTH_NAMES[month - 1], totalExpenses },
  }
}
