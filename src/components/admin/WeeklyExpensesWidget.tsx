import type { WidgetServerProps } from 'payload'
import { getUserTimezone } from '@/utilities/getUserTimezone'

type DayEntry = { date: string; day: string; total: number }

const DAY_LABELS: Record<string, string> = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed',
  thu: 'Thu', fri: 'Fri', sat: 'Sat',
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function fmtAmount(n: number): string {
  if (n === 0) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return n.toLocaleString('en-US')
}

export default async function WeeklyExpensesWidget({ req }: WidgetServerProps) {
  if (!req.user) return null

  const timezone = await getUserTimezone(req)
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
    const d = localFmt.format(new Date(tx.date as string))
    byDate[d] = (byDate[d] ?? 0) + parseFloat((tx.amount as string) || '0')
  }

  const dailyData: DayEntry[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayLocal + 'T00:00:00')
    d.setDate(d.getDate() - i)
    const dateStr = localFmt.format(d)
    dailyData.push({ date: dateStr, day: DAY_NAMES[d.getDay()], total: byDate[dateStr] ?? 0 })
  }

  const maxVal = Math.max(...dailyData.map((d) => d.total), 1)
  const todayDow = DAY_NAMES[new Date(todayLocal + 'T00:00:00').getDay()]

  return (
    <div
      className="twp"
      style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-border-color)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
      }}
    >
      <h3 className="mb-5 text-base font-bold text-[var(--theme-text)]">Expenses This Week</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 48px))', gap: '8px', justifyContent: 'space-between' }}>
        {dailyData.map((day) => {
          const fillPct = (day.total / maxVal) * 100
          const isActive = day.total > 0
          const isToday = day.day === todayDow

          return (
            <div key={day.day} className="flex flex-col items-center gap-2">
              <span
                className="text-xs font-medium text-[var(--theme-text)]"
                style={{ opacity: isActive ? 1 : 0.4 }}
              >
                {fmtAmount(day.total)}
              </span>

              <div
                className="relative w-full overflow-hidden rounded-full bg-[var(--theme-elevation-100)]"
                style={{ height: 160 }}
              >
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-full bg-red-400"
                    style={{ height: `${fillPct}%` }}
                  />
                )}
              </div>

              <span
                className="text-xs"
                style={{
                  fontWeight: isToday ? 700 : undefined,
                  opacity: isToday ? 1 : 0.5,
                }}
              >
                {DAY_LABELS[day.day]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
