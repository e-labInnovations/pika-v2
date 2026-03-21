import type { WidgetServerProps } from 'payload'
import { getUserTimezone } from '@/utilities/getUserTimezone'
import { calculateMonthlyTags } from '@/utilities/calculateMonthlyTags'
import DynamicIcon from '@/components/lucide/dynamic-icon'

function fmtAmount(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return n < 0 ? `-${abs}` : abs
}

export default async function MonthlyTagWidget({ req }: WidgetServerProps) {
  if (!req.user) return null

  const timezone = await getUserTimezone(req)
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  const [year, month] = localFmt.format(new Date()).split('-').map(Number)
  const { data, meta } = await calculateMonthlyTags(req.payload, req.user.id, month, year, timezone)

  const active = data.filter((t) => t.totalTransactionCount > 0)

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
      <h3 className="mb-4 text-base font-bold text-[var(--theme-text)]">
        Tag Activity{' '}
        <span className="font-normal opacity-50">
          — {meta.monthName} {meta.year}
        </span>
      </h3>

      {active.length === 0 && <p className="text-sm opacity-40">No tagged transactions this month.</p>}

      <div className="space-y-2">
        {active.map((tag) => {
          const isPositive = tag.totalAmount >= 0
          return (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: tag.bgColor ?? 'var(--theme-elevation-100)' }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.25)' }}
              >
                <DynamicIcon
                  name={(tag.icon as any) ?? 'tag'}
                  size={16}
                  color={tag.color ?? '#fff'}
                />
              </div>

              <span className="flex-1 text-sm font-semibold" style={{ color: tag.color ?? '#fff' }}>
                {tag.name}
              </span>

              <span
                className="rounded-full px-3 py-1 text-sm font-bold"
                style={{
                  background: isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.2)',
                  color: isPositive ? '#4ade80' : '#f87171',
                  border: `1px solid ${isPositive ? 'rgba(34,197,94,0.4)' : 'rgba(248,113,113,0.4)'}`,
                }}
              >
                {fmtAmount(tag.totalAmount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
