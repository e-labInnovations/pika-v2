import Link from 'next/link'
import React from 'react'

import type { Transaction } from '@/payload-types'
import { formatLocalDateTime, formatSigned } from '@/lib/web/format'
import { cn } from '@/lib/utils'
import { EntityIcon } from './EntityIcon'

type Rel = { id: string; name?: string | null; icon?: string | null; color?: string | null; bgColor?: string | null }
const rel = (v: unknown): Rel | null => (v && typeof v === 'object' ? (v as Rel) : null)

export const amountClass = (type: string) => (type === 'expense' ? 'text-expense' : type === 'income' ? 'text-income' : 'text-foreground')

/** A compact list of transactions (depth 1), each opening its panel. */
export function TxList({ docs, tz, currency }: { docs: Transaction[]; tz: string; currency: string }) {
  return (
    <ul className="divide-y">
      {docs.map((t) => {
        const cat = rel(t.category)
        const acc = rel(t.account)
        return (
          <li key={t.id}>
            <Link href={`/app/transactions/${t.id}`} className="flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-accent/50">
              <EntityIcon icon={cat?.icon} color={cat?.color} bgColor={cat?.bgColor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[cat?.name, acc?.name, formatLocalDateTime(t.date, tz)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums', amountClass(t.type))}>{formatSigned(Number(t.amount), t.type, currency)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
