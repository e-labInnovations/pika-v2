import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { BarList } from '@/components/web/BarList'
import { Card, Empty } from '@/components/web/Card'
import { EntityIcon } from '@/components/web/EntityIcon'
import { requireSession } from '@/lib/session'
import { toSearch, type TxQuery } from '@/lib/web/filters'
import { formatMoney } from '@/lib/web/format'
import { monthDays, monthKey, parseMonth, shiftMonth, type YM } from '@/lib/web/month'
import { cn } from '@/lib/utils'
import { calculateMonthlyCategories } from '@/utilities/calculateMonthlyCategories'
import { calculateMonthlyPeople } from '@/utilities/calculateMonthlyPeople'
import { calculateMonthlyTags } from '@/utilities/calculateMonthlyTags'

export const metadata = { title: 'Reports' }

const TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'tags', label: 'Tags' },
  { key: 'people', label: 'People' },
] as const
type Tab = (typeof TABS)[number]['key']

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; tab?: string }> }) {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const sp = await searchParams
  const ym = parseMonth(sp.month, tz)
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'categories'
  const days = monthDays(ym)
  const money = (n: number) => formatMoney(n, currency)
  const href = (next: { ym?: YM; tab?: Tab }) => `/app/reports?month=${monthKey(next.ym ?? ym)}&tab=${next.tab ?? tab}`
  const txLink = (q: Partial<TxQuery>) => `/app/transactions${toSearch({ ...q, ...days })}`
  const title = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ym.y, ym.m - 1, 1)))
  const userId = String(user.id)

  let body: React.ReactNode
  if (tab === 'categories') {
    const res = await calculateMonthlyCategories(payload, userId, ym.m, ym.y, tz)
    const parents = res.data.filter((c) => c.isParent && c.amount > 0)
    const kids = (id: string) => res.data.filter((c) => c.parentId === id && c.amount > 0).sort((a, b) => b.amount - a.amount)
    body = parents.length ? (
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title={`Spent ${money(res.meta.totalExpenses)}`} className="xl:col-span-2">
          <BarList data={parents.slice(0, 10).map((p) => ({ name: p.name, value: p.amount, color: p.color }))} currency={currency} />
        </Card>
        <Card className="xl:col-span-3">
          <ul className="divide-y">
            {parents.map((p) => (
              <li key={p.id} className="py-2">
                <Link href={txLink({ categories: [p.id], types: ['expense'] })} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-accent/50">
                  <EntityIcon icon={p.icon} color={p.color} bgColor={p.bgColor} size={32} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.transactionCount} · {res.meta.totalExpenses ? Math.round((p.amount / res.meta.totalExpenses) * 100) : 0}%</span>
                  <span className="w-28 text-right font-semibold tabular-nums">{money(p.amount)}</span>
                </Link>
                <ul>
                  {kids(p.id).map((c) => (
                    <li key={c.id}>
                      <Link href={txLink({ categories: [c.id], types: ['expense'] })} className="flex items-center gap-3 rounded-lg py-1 pr-1 pl-12 text-sm hover:bg-accent/50">
                        <span className="flex-1 text-muted-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.transactionCount}</span>
                        <span className="w-28 text-right tabular-nums">{money(c.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    ) : (
      <Card><Empty>No spending in {title}.</Empty></Card>
    )
  } else if (tab === 'tags') {
    const res = await calculateMonthlyTags(payload, userId, ym.m, ym.y, tz)
    const used = res.data.filter((t) => t.totalTransactionCount > 0)
    body = used.length ? (
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 font-medium">Tag</th>
              <th className="py-2 text-right font-medium">Count</th>
              <th className="py-2 text-right font-medium">Spent</th>
              <th className="py-2 text-right font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {used.map((t) => (
              <tr key={t.id} className="hover:bg-accent/40">
                <td className="py-2">
                  <Link href={txLink({ tags: [t.id] })} className="flex items-center gap-2">
                    <EntityIcon icon={t.icon} color={t.color} bgColor={t.bgColor} size={26} className="rounded-md" />
                    {t.name}
                  </Link>
                </td>
                <td className="py-2 text-right tabular-nums">{t.totalTransactionCount}</td>
                <td className="py-2 text-right text-expense tabular-nums">{t.expenseAmount ? money(t.expenseAmount) : '—'}</td>
                <td className="py-2 text-right text-income tabular-nums">{t.incomeAmount ? money(t.incomeAmount) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    ) : (
      <Card><Empty>No tagged transactions in {title}.</Empty></Card>
    )
  } else {
    const res = await calculateMonthlyPeople(payload, userId, ym.m, ym.y, tz)
    const used = res.data.filter((p) => p.totalTransactionCount > 0)
    body = used.length ? (
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 font-medium">Person</th>
              <th className="py-2 text-right font-medium">Count</th>
              <th className="py-2 text-right font-medium">Spent on</th>
              <th className="py-2 text-right font-medium">Received from</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {used.map((p) => (
              <tr key={p.id} className="hover:bg-accent/40">
                <td className="py-2">
                  <Link href={txLink({ people: [p.id] })} className="font-medium">{p.name}</Link>
                </td>
                <td className="py-2 text-right tabular-nums">{p.totalTransactionCount}</td>
                <td className="py-2 text-right text-expense tabular-nums">{p.expenseAmount ? money(p.expenseAmount) : '—'}</td>
                <td className="py-2 text-right text-income tabular-nums">{p.incomeAmount ? money(p.incomeAmount) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    ) : (
      <Card><Empty>No transactions with people in {title}.</Empty></Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold tracking-tight">Reports</h1>
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          <Link href={href({ ym: shiftMonth(ym, -1) })} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-accent">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="w-36 text-center text-sm font-medium">{title}</span>
          <Link href={href({ ym: shiftMonth(ym, 1) })} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-accent">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key })}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', t.key === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {body}
    </div>
  )
}
