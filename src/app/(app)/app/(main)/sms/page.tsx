import React from 'react'

import { Card, Empty } from '@/components/web/Card'
import { SmsCard } from '@/components/web/SmsCard'
import { requireSession } from '@/lib/session'
import { formatLocalDateTime } from '@/lib/web/format'
import { listPendingSms } from '@/lib/web/sms'
import { loadLookups } from '@/lib/web/transactions'

export const metadata = { title: 'SMS review' }

type Parsed = { type?: string; amount?: string; merchant?: string | null; occurredAt?: string | null; ref?: string | null }
type Suggestion = {
  title?: string
  type?: string
  category?: string | null
  tags?: string[]
  person?: string | null
  toAccount?: string | null
  parts?: { title: string; amount: string; category: string | null }[]
  possibleDuplicate?: { id: string; title: string; amount: string; date: string }
}

export default async function SmsPage() {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const [list, lookups] = await Promise.all([listPendingSms(payload, user), loadLookups(payload, user)])
  const { childrenOf: _, ...lists } = lookups
  const live = { categories: lists.categories.filter((c) => !c.archived), tags: lists.tags.filter((t) => !t.archived), people: lists.people.filter((p) => !p.archived), accounts: lists.accounts.filter((a) => !a.archived) }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SMS review</h1>
        <p className="text-sm text-muted-foreground">Bank messages Pika captured on your phone, waiting to become transactions.</p>
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty>Nothing waiting. New bank SMS show up here.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {list.map((s) => {
            const p = (s.parsed ?? {}) as Parsed
            const g = (s.suggestion ?? {}) as Suggestion
            const acc = typeof s.account === 'object' ? s.account?.id : s.account
            return (
              <SmsCard
                key={s.id}
                currency={currency}
                lists={live}
                sms={{
                  id: String(s.id),
                  body: s.body,
                  sender: s.sender,
                  when: formatLocalDateTime(p.occurredAt || s.receivedAt, tz),
                  type: (g.type || p.type || 'expense') as 'expense' | 'income' | 'transfer',
                  amount: p.amount ?? '0',
                  merchant: p.merchant ?? null,
                  account: acc ? String(acc) : null,
                  title: g.title ?? p.merchant ?? '',
                  category: g.category ?? null,
                  tags: g.tags ?? [],
                  person: g.person ?? null,
                  toAccount: g.toAccount ?? null,
                  parts: (g.parts ?? []).map((x) => ({ title: x.title, amount: x.amount, category: x.category })),
                  duplicate: g.possibleDuplicate ? { ...g.possibleDuplicate, when: formatLocalDateTime(g.possibleDuplicate.date, tz) } : null,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
