import React from 'react'

import { Empty } from '@/components/web/Card'
import { FilterBar } from '@/components/web/FilterBar'
import { Pager } from '@/components/web/Pager'
import { TotalsBar } from '@/components/web/TotalsBar'
import { TxTable } from '@/components/web/TxTable'
import { requireSession } from '@/lib/session'
import { PAGE_SIZE, parseTxParams } from '@/lib/web/filters'
import { listTransactions, loadLookups } from '@/lib/web/transactions'

export const metadata = { title: 'Transactions' }

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const query = parseTxParams(await searchParams)
  const lookups = await loadLookups(payload, user)
  const res = await listTransactions(payload, user, query, tz, lookups)
  const { childrenOf: _, ...lists } = lookups

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        {query.q && <p className="truncate text-sm text-muted-foreground">Matching “{query.q}”</p>}
      </div>
      <FilterBar query={query} lists={lists} />
      <TotalsBar summary={res.summary} currency={currency} />
      {res.docs.length ? <TxTable docs={res.docs} tz={tz} currency={currency} /> : <div className="rounded-2xl border bg-card"><Empty>No transactions match.</Empty></div>}
      <Pager query={query} totalPages={res.totalPages} totalDocs={res.totalDocs} pageSize={PAGE_SIZE} />
    </div>
  )
}
