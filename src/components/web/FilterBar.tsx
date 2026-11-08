'use client'

import { Check, ChevronDown, Download, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toSearch, type TxQuery, type TxSort, type TxType } from '@/lib/web/filters'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { EntityIcon } from './EntityIcon'

type ListKey = 'categories' | 'tags' | 'people' | 'accounts'
type Lists = Record<ListKey, LookupItem[]>

const TYPES: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
]
const SORTS: { value: TxSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
]
const TYPE_ORDER = ['expense', 'income', 'transfer'] as const
const TYPE_LABEL = { expense: 'Expense', income: 'Income', transfer: 'Transfer' } as const
const LABEL: Record<ListKey, string> = { categories: 'Category', tags: 'Tag', people: 'Person', accounts: 'Account' }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function presets(): { label: string; from: string; to: string }[] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const d30 = new Date(now.getTime() - 29 * 86_400_000)
  return [
    { label: 'This month', from: ymd(first), to: ymd(now) },
    { label: 'Last month', from: ymd(lastFirst), to: ymd(lastEnd) },
    { label: 'Last 30 days', from: ymd(d30), to: ymd(now) },
    { label: 'This year', from: `${now.getFullYear()}-01-01`, to: ymd(now) },
  ]
}

const chip = 'inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm hover:bg-accent'

/** Filters as URL params: every change replaces the URL (page back to 1), the server re-renders. */
export function FilterBar({ query, lists }: { query: TxQuery; lists: Lists }) {
  const router = useRouter()
  const pathname = usePathname()
  const go = (next: Partial<TxQuery>) => router.replace(pathname + toSearch({ ...query, ...next, page: 1 }), { scroll: false })
  const active =
    query.types.length + query.categories.length + query.tags.length + query.people.length + query.accounts.length > 0 ||
    !!query.from || !!query.to || query.min !== undefined || query.max !== undefined || !!query.q

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TYPES.map((t) => {
        const on = query.types.includes(t.value)
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => go({ types: on ? query.types.filter((x) => x !== t.value) : [...query.types, t.value] })}
            className={cn(chip, on && 'border-primary bg-primary/15 text-primary')}
          >
            {t.label}
          </button>
        )
      })}

      <DateFilter query={query} go={go} />
      {(['categories', 'tags', 'people', 'accounts'] as ListKey[]).map((k) => (
        <MultiPick key={k} label={LABEL[k]} items={lists[k]} selected={query[k]} onChange={(ids) => go({ [k]: ids })} categories={k === 'categories'} />
      ))}
      <AmountFilter query={query} go={go} />

      <select
        value={query.sort}
        onChange={(e) => go({ sort: e.target.value as TxSort })}
        className={cn(chip, 'pr-2')}
        aria-label="Sort"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {active && (
        <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex h-9 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <X className="size-4" /> Clear
        </button>
      )}
      <a href={`/app/transactions/export${toSearch({ ...query, page: 1 })}`} className={cn(chip, 'ml-auto')}>
        <Download className="size-4" /> Export CSV
      </a>
    </div>
  )
}

function DateFilter({ query, go }: { query: TxQuery; go: (n: Partial<TxQuery>) => void }) {
  const label = query.from || query.to ? `${query.from ?? '…'} → ${query.to ?? '…'}` : 'Date'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chip, (query.from || query.to) && 'border-primary bg-primary/15 text-primary')}>
          {label} <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <div className="grid grid-cols-2 gap-2">
          {presets().map((p) => (
            <button key={p.label} type="button" onClick={() => go({ from: p.from, to: p.to })} className="rounded-lg border px-2 py-1.5 text-sm hover:bg-accent">
              {p.label}
            </button>
          ))}
        </div>
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            go({ from: String(f.get('from') || '') || undefined, to: String(f.get('to') || '') || undefined })
          }}
        >
          <label className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            From
            <input name="from" type="date" defaultValue={query.from} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            To
            <input name="to" type="date" defaultValue={query.to} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground" />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="h-9 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Apply</button>
            <button type="button" onClick={() => go({ from: undefined, to: undefined })} className="h-9 rounded-lg border px-3 text-sm">Any date</button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function AmountFilter({ query, go }: { query: TxQuery; go: (n: Partial<TxQuery>) => void }) {
  const on = query.min !== undefined || query.max !== undefined
  const label = on ? `₹${query.min ?? 0} – ${query.max !== undefined ? `₹${query.max}` : 'any'}` : 'Amount'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chip, on && 'border-primary bg-primary/15 text-primary')}>
          {label} <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <form
          className="grid grid-cols-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const n = (k: string) => (f.get(k) === '' || f.get(k) == null ? undefined : Number(f.get(k)))
            go({ min: n('min'), max: n('max') })
          }}
        >
          <input name="min" type="number" min={0} step="0.01" placeholder="Min" defaultValue={query.min} className="h-9 rounded-lg border bg-background px-2 text-sm" />
          <input name="max" type="number" min={0} step="0.01" placeholder="Max" defaultValue={query.max} className="h-9 rounded-lg border bg-background px-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="h-9 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Apply</button>
            <button type="button" onClick={() => go({ min: undefined, max: undefined })} className="h-9 rounded-lg border px-3 text-sm">Any</button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function MultiPick({
  label,
  items,
  selected,
  onChange,
  categories,
}: {
  label: string
  items: LookupItem[]
  selected: string[]
  onChange: (ids: string[]) => void
  categories?: boolean
}) {
  const [search, setSearch] = React.useState('')
  const [showArchived, setShowArchived] = React.useState(false)
  const q = search.trim().toLowerCase()
  const byId = new Map(items.map((i) => [i.id, i]))
  const parentName = (i: LookupItem) => (i.parentId ? byId.get(i.parentId)?.name : undefined)
  const match = (i: LookupItem) => !q || i.name.toLowerCase().includes(q) || (parentName(i) ?? '').toLowerCase().includes(q)
  const live = items.filter((i) => !i.archived && match(i))
  const old = items.filter((i) => i.archived && match(i))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const names = selected.map((id) => byId.get(id)?.name).filter(Boolean)
  const text = names.length === 0 ? label : names.length === 1 ? names[0] : `${label}: ${names.length}`

  const row = (i: LookupItem) => {
    const on = selected.includes(i.id)
    return (
      <button
        key={i.id}
        type="button"
        role="menuitemcheckbox"
        aria-checked={on}
        onClick={() => toggle(i.id)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent',
          categories && i.parentId && 'pl-8',
          on && 'bg-primary/15 text-primary hover:bg-primary/20',
        )}
      >
        <EntityIcon icon={i.icon} color={i.color} bgColor={i.bgColor} size={22} className="rounded-md" />
        <span className="min-w-0 flex-1 truncate">{i.name}</span>
        {on && <Check className="size-4 shrink-0" />}
      </button>
    )
  }
  // Categories: each parent followed by its children.
  const ordered = (list: LookupItem[]) =>
    categories
      ? list
          .filter((i) => !i.parentId || !list.some((p) => p.id === i.parentId))
          .flatMap((i) => [i, ...list.filter((c) => c.parentId === i.id)])
      : list

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chip, selected.length > 0 && 'border-primary bg-primary/15 text-primary')}>
          <span className="max-w-40 truncate">{text}</span> <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="mb-2 h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
        />
        <div className="max-h-72 overflow-y-auto">
          {categories
            ? TYPE_ORDER.filter((t) => live.some((i) => i.type === t)).map((t) => (
                <div key={t}>
                  <p className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{TYPE_LABEL[t]}</p>
                  {ordered(live.filter((i) => i.type === t)).map(row)}
                </div>
              ))
            : ordered(live).map(row)}
          {live.length === 0 && old.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nothing found.</p>}
          {old.length > 0 && (
            <>
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="mt-2 w-full px-2 py-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Archived ({old.length}) {showArchived || q || old.some((i) => selected.includes(i.id)) ? '▾' : '▸'}
              </button>
              {(showArchived || !!q || old.some((i) => selected.includes(i.id))) && <div className="opacity-70">{ordered(old).map(row)}</div>}
            </>
          )}
        </div>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="mt-2 w-full rounded-lg border py-1.5 text-sm hover:bg-accent">
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
