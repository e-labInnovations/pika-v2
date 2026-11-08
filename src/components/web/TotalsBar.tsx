import React from 'react'

import type { SearchSummary } from '@/utilities/search/searchSummary'
import { formatMoney } from '@/lib/web/format'

/** Totals over every matching transaction, not just this page. */
export function TotalsBar({ summary, currency }: { summary: SearchSummary; currency: string }) {
  const net = summary.received - summary.spent
  const items = [
    { label: 'Transactions', value: String(summary.count) },
    { label: 'Spent', value: formatMoney(summary.spent, currency), cls: 'text-expense' },
    { label: 'Received', value: formatMoney(summary.received, currency), cls: 'text-income' },
    { label: 'Net', value: formatMoney(net, currency), cls: net < 0 ? 'text-expense' : 'text-income' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{i.label}</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${i.cls ?? ''}`}>{i.value}</p>
        </div>
      ))}
    </div>
  )
}
