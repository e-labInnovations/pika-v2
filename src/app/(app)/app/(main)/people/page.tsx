import Link from 'next/link'
import React from 'react'

import { Card, Empty } from '@/components/web/Card'
import { requireSession } from '@/lib/session'
import { formatLocalDate, formatMoney } from '@/lib/web/format'
import { cn } from '@/lib/utils'
import { calculateMonthlyPeople, type PersonActivity } from '@/utilities/calculateMonthlyPeople'
import { localParts } from '@/utilities/localMonth'

export const metadata = { title: 'People' }

/** balance < 0: they owe you; > 0: you owe them (as in the phone app). */
function BalanceText({ balance, currency }: { balance: number; currency: string }) {
  if (Math.abs(balance) < 0.01) return <span className="text-muted-foreground">Settled</span>
  return balance < 0 ? (
    <span className="text-income">Owes you {formatMoney(-balance, currency)}</span>
  ) : (
    <span className="text-expense">You owe {formatMoney(balance, currency)}</span>
  )
}

export default async function PeoplePage() {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const now = localParts(new Date(), tz)
  const [res, people] = await Promise.all([
    calculateMonthlyPeople(payload, String(user.id), now.m, now.y, tz),
    payload.find({ collection: 'people', pagination: false, depth: 0, select: { name: true, isActive: true }, user, overrideAccess: false }),
  ])
  // Every person (the report drops archived ones with nothing open); balances from the report.
  const stats = new Map(res.data.map((p) => [p.id, p]))
  const rows = people.docs
    .map((p) => ({ id: String(p.id), name: String(p.name ?? ''), archived: p.isActive === false, s: stats.get(String(p.id)) as PersonActivity | undefined }))
    .sort((a, b) => Math.abs(b.s?.balance ?? 0) - Math.abs(a.s?.balance ?? 0) || a.name.localeCompare(b.name))
  const live = rows.filter((r) => !r.archived)
  const old = rows.filter((r) => r.archived)
  const owed = rows.reduce((t, r) => t + Math.max(0, -(r.s?.balance ?? 0)), 0)
  const owe = rows.reduce((t, r) => t + Math.max(0, r.s?.balance ?? 0), 0)

  const list = (items: typeof rows) => (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/app/people/${r.id}`} className="flex items-center gap-4 rounded-lg px-1 py-3 hover:bg-accent/50">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">{r.name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.s?.lastTransactionAt ? `Last: ${formatLocalDate(r.s.lastTransactionAt, tz)}` : 'No transactions'}</p>
            </div>
            <span className="text-sm font-medium tabular-nums">
              <BalanceText balance={r.s?.balance ?? 0} currency={currency} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold tracking-tight">People</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Owed to you</p>
          <p className="mt-2 text-2xl font-bold text-income tabular-nums">{formatMoney(owed, currency)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">You owe</p>
          <p className="mt-2 text-2xl font-bold text-expense tabular-nums">{formatMoney(owe, currency)}</p>
        </div>
      </div>
      <Card>{live.length ? list(live) : <Empty>No people yet.</Empty>}</Card>
      {old.length > 0 && (
        <details className="rounded-2xl border bg-card p-5">
          <summary className={cn('cursor-pointer text-sm font-semibold tracking-wide text-muted-foreground uppercase')}>Archived ({old.length})</summary>
          <div className="mt-3 opacity-70">{list(old)}</div>
        </details>
      )}
    </div>
  )
}
