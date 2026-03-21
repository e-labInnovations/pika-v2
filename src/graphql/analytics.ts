import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'
import { calculateDashboard } from '../utilities/calculateDashboard'
import { calculateMonthlyCategories } from '../utilities/calculateMonthlyCategories'
import { calculateMonthlyTags } from '../utilities/calculateMonthlyTags'
import { calculateMonthlyPeople } from '../utilities/calculateMonthlyPeople'

// ─── Dashboard ────────────────────────────────────────────────────────────────

const MonthlyPulseType = new GraphQLObjectType({
  name: 'MonthlyPulse',
  fields: {
    income: { type: new GraphQLNonNull(GraphQLFloat) },
    expenses: { type: new GraphQLNonNull(GraphQLFloat) },
    surplus: { type: new GraphQLNonNull(GraphQLFloat) },
    month: { type: new GraphQLNonNull(GraphQLInt) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    monthName: { type: new GraphQLNonNull(GraphQLString) },
  },
})

const DashboardResultType = new GraphQLObjectType({
  name: 'DashboardResult',
  fields: {
    totalBalance: { type: new GraphQLNonNull(GraphQLFloat) },
    balanceChangePercent: { type: GraphQLFloat }, // nullable — null when no last-month data
    monthlyPulse: { type: new GraphQLNonNull(MonthlyPulseType) },
  },
})

// ─── Shared helper ────────────────────────────────────────────────────────────

async function getUserTimezone(context: { req: { payload: any; user?: any } }): Promise<string> {
  const userId = context.req.user?.id
  if (!userId) return 'UTC'
  try {
    const settings = await context.req.payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      context: { internal: true },
    })
    return (settings.docs[0]?.timezone as string) || 'UTC'
  } catch {
    return 'UTC'
  }
}

// ─── Weekly Expenses ──────────────────────────────────────────────────────────

const WeeklyExpensesDayType = new GraphQLObjectType({
  name: 'WeeklyExpensesDay',
  fields: {
    date: { type: new GraphQLNonNull(GraphQLString) },
    day: { type: new GraphQLNonNull(GraphQLString) },
    total: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const WeeklyExpensesType = new GraphQLObjectType({
  name: 'WeeklyExpenses',
  fields: {
    sun: { type: new GraphQLNonNull(GraphQLFloat) },
    mon: { type: new GraphQLNonNull(GraphQLFloat) },
    tue: { type: new GraphQLNonNull(GraphQLFloat) },
    wed: { type: new GraphQLNonNull(GraphQLFloat) },
    thu: { type: new GraphQLNonNull(GraphQLFloat) },
    fri: { type: new GraphQLNonNull(GraphQLFloat) },
    sat: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const WeeklyExpensesResultType = new GraphQLObjectType({
  name: 'WeeklyExpensesResult',
  fields: {
    days: { type: new GraphQLNonNull(WeeklyExpensesType) },
    dailyData: { type: new GraphQLList(WeeklyExpensesDayType) },
    timezone: { type: new GraphQLNonNull(GraphQLString) },
  },
})

// ─── Monthly Calendar ─────────────────────────────────────────────────────────

const CalendarDayType = new GraphQLObjectType({
  name: 'CalendarDay',
  fields: {
    date: { type: new GraphQLNonNull(GraphQLString) },
    income: { type: new GraphQLNonNull(GraphQLFloat) },
    expenses: { type: new GraphQLNonNull(GraphQLFloat) },
    transfers: { type: new GraphQLNonNull(GraphQLFloat) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    transactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    incomeTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    expenseTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    transferTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
  },
})

const MonthlyCalendarMetaType = new GraphQLObjectType({
  name: 'MonthlyCalendarMeta',
  fields: {
    month: { type: new GraphQLNonNull(GraphQLInt) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    monthName: { type: new GraphQLNonNull(GraphQLString) },
    timezone: { type: new GraphQLNonNull(GraphQLString) },
    totalIncome: { type: new GraphQLNonNull(GraphQLFloat) },
    totalExpenses: { type: new GraphQLNonNull(GraphQLFloat) },
    totalTransfers: { type: new GraphQLNonNull(GraphQLFloat) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyCalendarResultType = new GraphQLObjectType({
  name: 'MonthlyCalendarResult',
  fields: {
    data: { type: new GraphQLList(CalendarDayType) },
    meta: { type: new GraphQLNonNull(MonthlyCalendarMetaType) },
  },
})

// ─── Monthly Categories ───────────────────────────────────────────────────────

const CategoryActivityType = new GraphQLObjectType({
  name: 'CategoryActivity',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    icon: { type: GraphQLString },
    color: { type: GraphQLString },
    bgColor: { type: GraphQLString },
    description: { type: GraphQLString },
    isSystem: { type: new GraphQLNonNull(GraphQLBoolean) },
    isParent: { type: new GraphQLNonNull(GraphQLBoolean) },
    parentId: { type: GraphQLString },
    amount: { type: new GraphQLNonNull(GraphQLFloat) },
    transactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    averagePerTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    highestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    lowestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyCategoriesMetaType = new GraphQLObjectType({
  name: 'MonthlyCategoriesMeta',
  fields: {
    month: { type: new GraphQLNonNull(GraphQLInt) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    monthName: { type: new GraphQLNonNull(GraphQLString) },
    totalExpenses: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyCategoriesResultType = new GraphQLObjectType({
  name: 'MonthlyCategoriesResult',
  fields: {
    data: { type: new GraphQLList(CategoryActivityType) },
    meta: { type: new GraphQLNonNull(MonthlyCategoriesMetaType) },
  },
})

// ─── Monthly Tags ─────────────────────────────────────────────────────────────

const TagActivityType = new GraphQLObjectType({
  name: 'TagActivity',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    icon: { type: GraphQLString },
    color: { type: GraphQLString },
    bgColor: { type: GraphQLString },
    description: { type: GraphQLString },
    isSystem: { type: new GraphQLNonNull(GraphQLBoolean) },
    totalAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    totalTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    expenseAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    expenseTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    incomeAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    incomeTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    transferAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    transferTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    averagePerTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    highestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    lowestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyTagsMetaType = new GraphQLObjectType({
  name: 'MonthlyTagsMeta',
  fields: {
    month: { type: new GraphQLNonNull(GraphQLInt) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    monthName: { type: new GraphQLNonNull(GraphQLString) },
    totalExpenses: { type: new GraphQLNonNull(GraphQLFloat) },
    totalIncome: { type: new GraphQLNonNull(GraphQLFloat) },
    totalTransfers: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyTagsResultType = new GraphQLObjectType({
  name: 'MonthlyTagsResult',
  fields: {
    data: { type: new GraphQLList(TagActivityType) },
    meta: { type: new GraphQLNonNull(MonthlyTagsMetaType) },
  },
})

// ─── Monthly People ───────────────────────────────────────────────────────────

const PersonActivityType = new GraphQLObjectType({
  name: 'PersonActivity',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: GraphQLString },
    phone: { type: GraphQLString },
    description: { type: GraphQLString },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    totalAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    totalTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    expenseAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    expenseTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    incomeAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    incomeTransactionCount: { type: new GraphQLNonNull(GraphQLInt) },
    averagePerTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    highestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    lowestTransaction: { type: new GraphQLNonNull(GraphQLFloat) },
    lastTransactionAt: { type: GraphQLString },
  },
})

const MonthlyPeopleMetaType = new GraphQLObjectType({
  name: 'MonthlyPeopleMeta',
  fields: {
    month: { type: new GraphQLNonNull(GraphQLInt) },
    year: { type: new GraphQLNonNull(GraphQLInt) },
    monthName: { type: new GraphQLNonNull(GraphQLString) },
    totalExpenses: { type: new GraphQLNonNull(GraphQLFloat) },
    totalIncome: { type: new GraphQLNonNull(GraphQLFloat) },
  },
})

const MonthlyPeopleResultType = new GraphQLObjectType({
  name: 'MonthlyPeopleResult',
  fields: {
    data: { type: new GraphQLList(PersonActivityType) },
    meta: { type: new GraphQLNonNull(MonthlyPeopleMetaType) },
  },
})

// ─── Query resolvers ──────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export const analyticsQueries = () => ({
  /**
   * query { weeklyExpenses { days { mon tue } dailyData { date total } timezone } }
   */
  weeklyExpenses: {
    type: WeeklyExpensesResultType,
    resolve: async (_: unknown, __: unknown, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')

      const timezone = await getUserTimezone(context)
      const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
      const now = new Date()
      const todayLocal = localFmt.format(now)

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

      const byDate: Record<string, number> = {}
      for (const tx of result.docs) {
        const localDate = localFmt.format(new Date(tx.date as string))
        byDate[localDate] = (byDate[localDate] ?? 0) + parseFloat((tx.amount as string) || '0')
      }

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

      return { days, dailyData, timezone }
    },
  },

  /**
   * query { monthlyCalendar(month: 3, year: 2026) { data { date income expenses balance } meta { totalExpenses } } }
   */
  monthlyCalendar: {
    type: MonthlyCalendarResultType,
    args: {
      month: { type: GraphQLInt },
      year: { type: GraphQLInt },
    },
    resolve: async (_: unknown, args: { month?: number; year?: number }, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')

      const now = new Date()
      const month = args.month ?? now.getMonth() + 1
      const year = args.year ?? now.getFullYear()

      if (month < 1 || month > 12) throw new Error('Invalid month')

      const timezone = await getUserTimezone(context)
      const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })

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
        if (y !== year || m !== month) continue

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

      return {
        data,
        meta: {
          month, year,
          monthName: MONTH_NAMES[month - 1],
          timezone,
          totalIncome: Math.round(totalIncome * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          totalTransfers: Math.round(totalTransfers * 100) / 100,
          balance: Math.round((totalIncome - totalExpenses) * 100) / 100,
        },
      }
    },
  },

  /**
   * query { dashboardSummary { totalBalance balanceChangePercent monthlyPulse { income expenses surplus monthName } } }
   */
  dashboardSummary: {
    type: DashboardResultType,
    resolve: async (_: unknown, __: unknown, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')
      const timezone = await getUserTimezone(context)
      return calculateDashboard(req.payload, req.user.id, timezone)
    },
  },

  /**
   * query { monthlyCategories(month: 3, year: 2026) { data { name amount transactionCount } meta { totalExpenses } } }
   */
  monthlyCategories: {
    type: MonthlyCategoriesResultType,
    args: {
      month: { type: GraphQLInt },
      year: { type: GraphQLInt },
    },
    resolve: async (_: unknown, args: { month?: number; year?: number }, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')
      const now = new Date()
      const month = args.month ?? now.getMonth() + 1
      const year = args.year ?? now.getFullYear()
      if (month < 1 || month > 12) throw new Error('Invalid month')
      const timezone = await getUserTimezone(context)
      return calculateMonthlyCategories(req.payload, req.user.id, month, year, timezone)
    },
  },

  /**
   * query { monthlyTags(month: 3, year: 2026) { data { name expenseAmount incomeAmount } meta { totalExpenses } } }
   */
  monthlyTags: {
    type: MonthlyTagsResultType,
    args: {
      month: { type: GraphQLInt },
      year: { type: GraphQLInt },
    },
    resolve: async (_: unknown, args: { month?: number; year?: number }, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')
      const now = new Date()
      const month = args.month ?? now.getMonth() + 1
      const year = args.year ?? now.getFullYear()
      if (month < 1 || month > 12) throw new Error('Invalid month')
      const timezone = await getUserTimezone(context)
      return calculateMonthlyTags(req.payload, req.user.id, month, year, timezone)
    },
  },

  /**
   * query { monthlyPeople(month: 3, year: 2026) { data { name balance expenseAmount } meta { totalExpenses } } }
   */
  monthlyPeople: {
    type: MonthlyPeopleResultType,
    args: {
      month: { type: GraphQLInt },
      year: { type: GraphQLInt },
    },
    resolve: async (_: unknown, args: { month?: number; year?: number }, context: { req: any }) => {
      const { req } = context
      if (!req.user) throw new Error('Unauthorized')
      const now = new Date()
      const month = args.month ?? now.getMonth() + 1
      const year = args.year ?? now.getFullYear()
      if (month < 1 || month > 12) throw new Error('Invalid month')
      const timezone = await getUserTimezone(context)
      return calculateMonthlyPeople(req.payload, req.user.id, month, year, timezone)
    },
  },
})
