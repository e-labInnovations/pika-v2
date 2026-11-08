import Link from 'next/link'
import React from 'react'

import { Card, Empty } from '@/components/web/Card'
import { EntityIcon } from '@/components/web/EntityIcon'
import { TxList } from '@/components/web/TxList'
import { requireSession } from '@/lib/session'
import { toSearch } from '@/lib/web/filters'
import { formatMoney, localDay } from '@/lib/web/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/payload-types'
import { budgetsOverview } from '@/utilities/budgets'
import { calculateDashboard } from '@/utilities/calculateDashboard'
import { calculateInsights } from '@/utilities/insights'

export const metadata = { title: 'Home' }

const TONE = { warn: 'border-l-expense', good: 'border-l-income', info: 'border-l-primary' } as const

export default async function HomePage() {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const userId = String(user.id)
  const as = { user, overrideAccess: false as const }
  const [dash, insights, budgets, accounts, recent] = await Promise.all([
    calculateDashboard(payload, userId, tz),
    calculateInsights(payload, userId, tz),
    budgetsOverview(payload, userId, tz),
    payload.find({ collection: 'accounts', where: { user: { equals: user.id } }, sort: 'name', limit: 100, depth: 1, ...as }),
    payload.find({ collection: 'transactions', where: { user: { equals: user.id } }, sort: '-date', limit: 10, depth: 1, ...as }),
  ])
  const pulse = dash.monthlyPulse
  const liveAccounts = accounts.docs.filter((a) => a.isActive !== false || Math.abs(Number((a as { balance?: number }).balance ?? 0)) >= 0.01)
  const liveBudgets = budgets.filter((b) => !b.archived)
  const money = (n: number) => formatMoney(n, currency)

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hi, {(user.name || 'there').split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">{pulse.monthName} {pulse.year}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total balance" value={money(dash.totalBalance)} />
        <Stat label="Income this month" value={money(pulse.income)} tone="income" />
        <Stat label="Spent this month" value={money(pulse.expenses)} tone="expense" />
        <Stat
          label="Surplus"
          value={money(pulse.surplus)}
          note={dash.balanceChangePercent == null ? undefined : `${dash.balanceChangePercent > 0 ? '+' : ''}${dash.balanceChangePercent}% vs last month`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent" action={{ href: '/app/transactions', label: 'See all' }} className="xl:col-span-2">
          {recent.docs.length ? <TxList docs={recent.docs as Transaction[]} tz={tz} currency={currency} /> : <Empty>No transactions yet.</Empty>}
        </Card>

        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <Card title="Accounts">
            {liveAccounts.length ? (
              <ul className="grid grid-cols-1 gap-3">
                {liveAccounts.map((a) => (
                  <li key={a.id} className="min-w-0">
                    <Link href={`/app/transactions${toSearch({ accounts: [String(a.id)] })}`} className="flex items-center gap-3 hover:opacity-80">
                      <EntityIcon icon={a.icon} color={a.color} bgColor={a.bgColor} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{money(Number((a as { balance?: number }).balance ?? 0))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No accounts yet.</Empty>
            )}
          </Card>

          <Card title="Budgets">
            {liveBudgets.length ? (
              <ul className="grid grid-cols-1 gap-4">
                {liveBudgets.map((b) => (
                  <li key={b.id} className="min-w-0">
                    <Link href={`/app/transactions${toSearch({ categories: [b.category.id], types: ['expense'] })}`} className="block hover:opacity-80">
                      <div className="mb-1.5 flex justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{b.category.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {money(b.spent)} / {money(b.amount)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', b.status === 'over' ? 'bg-expense' : b.status === 'warn' ? 'bg-amber-500' : 'bg-income')}
                          style={{ width: `${Math.min(100, b.percent)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No budgets yet. Set one in the app.</Empty>
            )}
          </Card>
        </div>
      </div>

      {insights.length > 0 && (
        <Card title="Insights">
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i.key}>
                <Link
                  href={`/app/transactions${toSearch({ categories: i.filter.categories ?? [], q: i.filter.query, from: localDay(i.filter.dateFrom, tz), to: localDay(i.filter.dateTo, tz) })}`}
                  className={cn('block rounded-xl border border-l-4 bg-background/40 p-4 hover:bg-accent/40', TONE[i.tone])}
                >
                  <p className="text-sm font-semibold">{i.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{i.message}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'income' | 'expense' }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tone === 'income' && 'text-income', tone === 'expense' && 'text-expense')}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
