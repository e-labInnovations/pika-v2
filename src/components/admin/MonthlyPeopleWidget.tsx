import type { WidgetServerProps } from 'payload'
import { getUserTimezone } from '@/utilities/getUserTimezone'
import { calculateMonthlyPeople } from '@/utilities/calculateMonthlyPeople'

function fmtBalance(n: number): string {
  return Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default async function MonthlyPeopleWidget({ req }: WidgetServerProps) {
  if (!req.user) return null

  const timezone = await getUserTimezone(req)
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  const [year, month] = localFmt.format(new Date()).split('-').map(Number)
  const { data, meta } = await calculateMonthlyPeople(req.payload, req.user.id, month, year, timezone)

  // Show people with any activity this month or non-zero balance
  const visible = data.filter((p) => p.totalTransactionCount > 0 || p.balance !== 0)

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
        People Activity{' '}
        <span className="font-normal opacity-50">
          — {meta.monthName} {meta.year}
        </span>
      </h3>

      {visible.length === 0 && (
        <p className="text-sm opacity-40">No people activity this month.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((person) => {
          const isEven = Math.abs(person.balance) < 0.01
          const youOwe = person.balance > 0
          const borderColor = isEven ? '#22c55e' : youOwe ? '#f87171' : '#22c55e'
          const amountColor = isEven ? '#4ade80' : youOwe ? '#f87171' : '#4ade80'

          return (
            <div
              key={person.id}
              className="flex items-center gap-3 rounded-full px-3 py-2.5"
              style={{
                border: `2px solid ${borderColor}`,
                background: 'var(--theme-elevation-100)',
              }}
            >
              {/* Avatar / Initial */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: youOwe ? '#9333ea' : '#16a34a' }}
              >
                {initials(person.name)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                {isEven ? (
                  <>
                    <p className="text-sm font-bold" style={{ color: '#4ade80' }}>
                      Even
                    </p>
                    <p className="text-xs opacity-50">Settled</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold" style={{ color: amountColor }}>
                      {fmtBalance(person.balance)}
                    </p>
                    <p className="text-xs opacity-50">{youOwe ? 'You owe' : 'Owes you'}</p>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
