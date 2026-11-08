import Link from 'next/link'
import React from 'react'

import { toSearch, type TxQuery } from '@/lib/web/filters'
import { cn } from '@/lib/utils'

export function Pager({ query, totalPages, totalDocs, pageSize }: { query: TxQuery; totalPages: number; totalDocs: number; pageSize: number }) {
  if (totalPages <= 1 && query.page <= 1) return null
  const first = (query.page - 1) * pageSize + 1
  const last = Math.min(query.page * pageSize, totalDocs)
  const btn = 'rounded-lg border px-3 py-1.5 text-sm hover:bg-accent'
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{first <= totalDocs ? `${first}–${last} of ${totalDocs}` : `Page ${query.page} is past the end (${totalDocs} in all)`}</span>
      <div className="flex gap-2">
        {query.page > 1 && (
          <Link href={`/app/transactions${toSearch({ ...query, page: Math.min(query.page - 1, Math.max(totalPages, 1)) })}`} className={btn}>
            Previous
          </Link>
        )}
        <Link
          href={`/app/transactions${toSearch({ ...query, page: query.page + 1 })}`}
          aria-disabled={query.page >= totalPages}
          className={cn(btn, query.page >= totalPages && 'pointer-events-none opacity-40')}
        >
          Next
        </Link>
      </div>
    </div>
  )
}
