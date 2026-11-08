import Link from 'next/link'
import React from 'react'

import type { Transaction } from '@/payload-types'
import { formatLocalDateTime, formatSigned } from '@/lib/web/format'
import { cn } from '@/lib/utils'
import { EntityIcon } from './EntityIcon'
import { amountClass } from './TxList'

type Rel = { id: string; name?: string | null; icon?: string | null; color?: string | null; bgColor?: string | null }
const rel = (v: unknown): Rel | null => (v && typeof v === 'object' ? (v as Rel) : null)

/** The wide transactions table; each row opens the transaction's panel. */
export function TxTable({ docs, tz, currency }: { docs: Transaction[]; tz: string; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Tags</th>
            <th className="px-4 py-3 font-medium">Person</th>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {docs.map((t) => {
            const href = `/app/transactions/${t.id}`
            const cat = rel(t.category)
            const acc = rel(t.account)
            const to = rel(t.toAccount)
            const person = rel(t.person)
            const tags = (Array.isArray(t.tags) ? t.tags : []).map(rel).filter((x): x is Rel => !!x)
            const cell = 'block px-4 py-3'
            return (
              <tr key={t.id} className="hover:bg-accent/40">
                <td className="whitespace-nowrap text-muted-foreground">
                  <Link href={href} className={cell}>{formatLocalDateTime(t.date, tz)}</Link>
                </td>
                <td className="max-w-[260px]">
                  <Link href={href} className={cn(cell, 'truncate font-medium')} title={t.title ?? ''}>{t.title}</Link>
                </td>
                <td>
                  <Link href={href} className={cn(cell, 'flex items-center gap-2')}>
                    {cat && <EntityIcon icon={cat.icon} color={cat.color} bgColor={cat.bgColor} size={24} className="rounded-md" />}
                    <span className="truncate">{cat?.name ?? '—'}</span>
                  </Link>
                </td>
                <td>
                  <Link href={href} className={cn(cell, 'flex flex-wrap gap-1')}>
                    {tags.length
                      ? tags.map((g) => (
                          <span key={g.id} className="rounded-full px-2 py-0.5 text-xs" style={{ background: g.bgColor || 'var(--muted)', color: g.color || 'inherit' }}>
                            {g.name}
                          </span>
                        ))
                      : <span className="text-muted-foreground">—</span>}
                  </Link>
                </td>
                <td><Link href={href} className={cn(cell, 'truncate')}>{person?.name ?? '—'}</Link></td>
                <td>
                  <Link href={href} className={cn(cell, 'truncate')}>{to ? `${acc?.name ?? '?'} → ${to.name}` : (acc?.name ?? '—')}</Link>
                </td>
                <td className={cn('text-right font-semibold whitespace-nowrap tabular-nums', amountClass(t.type))}>
                  <Link href={href} className={cell}>{formatSigned(Number(t.amount), t.type, currency)}</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
