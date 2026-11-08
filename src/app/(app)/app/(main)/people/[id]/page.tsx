import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Card, Empty } from '@/components/web/Card'
import { TxTable } from '@/components/web/TxTable'
import { requireSession } from '@/lib/session'
import { parseTxParams, toSearch } from '@/lib/web/filters'
import { formatLocalDate, formatMoney } from '@/lib/web/format'
import { personSummary } from '@/lib/web/people'
import { listTransactions } from '@/lib/web/transactions'

export const metadata = { title: 'Person' }

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const { id } = await params
  const s = await personSummary(payload, user, id)
  if (!s) notFound()
  const { person, balance: b } = s
  const txs = await listTransactions(payload, user, parseTxParams({ people: id }), tz, { childrenOf: () => [] })
  const money = (n: number) => formatMoney(n, currency)

  return (
    <div className="grid gap-5">
      <Link href="/app/people" className="text-sm text-primary hover:underline">← People</Link>
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold tracking-tight">{person.name}</h1>
          <p className="text-sm text-muted-foreground">{[person.email, person.phone].filter(Boolean).join(' · ') || ' '}</p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Balance</p>
          <p className={`text-2xl font-bold tabular-nums ${b.balance < 0 ? 'text-income' : b.balance > 0 ? 'text-expense' : ''}`}>
            {Math.abs(b.balance) < 0.01 ? 'Settled' : b.balance < 0 ? `Owes you ${money(-b.balance)}` : `You owe ${money(b.balance)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Spent on them" value={money(b.totalSummary.totalSpent)} />
        <Stat label="Received from them" value={money(b.totalSummary.totalReceived)} />
        <Stat label="Transactions" value={String(b.totalTransactions)} />
      </div>

      {b.openShares.length > 0 && (
        <Card title="Open shares">
          <ul className="divide-y">
            {b.openShares.map((o) => (
              <li key={o.transaction}>
                <Link href={`/app/transactions/${o.transaction}`} className="flex items-center gap-4 rounded-lg px-1 py-2.5 text-sm hover:bg-accent/50">
                  <span className="flex-1 truncate">{o.title}</span>
                  {o.date && <span className="text-xs text-muted-foreground">{formatLocalDate(o.date, tz)}</span>}
                  <span className="text-muted-foreground tabular-nums">paid {money(o.paid)} of {money(o.share)}</span>
                  <span className="w-28 text-right font-semibold text-income tabular-nums">{money(o.remaining)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Transactions</h2>
        {txs.totalDocs > txs.docs.length && (
          <Link href={`/app/transactions${toSearch({ people: [id] })}`} className="text-sm text-primary hover:underline">See all {txs.totalDocs}</Link>
        )}
      </div>
      {txs.docs.length ? <TxTable docs={txs.docs} tz={tz} currency={currency} /> : <Card><Empty>No transactions with {person.name}.</Empty></Card>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
