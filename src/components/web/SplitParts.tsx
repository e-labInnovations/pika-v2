'use client'

import { Plus, Scissors, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { splitAction, suggestSplitAction } from '@/app/(app)/app/actions'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { Picker } from './Picker'

type Row = { key: number; title: string; amount: string; category: string[] }

const paise = (v: string | number) => Math.round(Number(v || 0) * 100)
const field = 'h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm outline-none'

/**
 * One payment, several things (rent + electricity): parts that add up to the amount.
 * The transaction becomes the first part; the rest are new transactions.
 */
export function SplitParts({ id, total, type, categories, defaultCategory }: { id: string; total: number; type: string; categories: LookupItem[]; defaultCategory: string | null }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const next = React.useRef(3)
  const [rows, setRows] = React.useState<Row[]>(() => [
    { key: 1, title: '', amount: '', category: defaultCategory ? [defaultCategory] : [] },
    { key: 2, title: '', amount: '', category: [] },
  ])
  const [hint, setHint] = React.useState('')
  const [busy, setBusy] = React.useState<'ai' | 'save' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const cats = categories.filter((c) => c.type === type && !c.archived)
  const left = (paise(total) - rows.reduce((s, r) => s + paise(r.amount), 0)) / 100
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium hover:bg-accent">
        <Scissors className="size-4" /> Split into parts
      </button>
    )
  }

  return (
    <div className="grid gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Split into parts</h3>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. 900 rent, rest electricity (optional)" className={field} />
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy('ai')
            setError(null)
            const res = await suggestSplitAction(id, hint)
            setBusy(null)
            if ('error' in res) return setError(res.error)
            setRows(res.parts.map((p) => ({ key: next.current++, title: p.title, amount: String(Number(p.amount)), category: p.category ? [p.category] : [] })))
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent disabled:opacity-60"
        >
          <Sparkles className="size-4" /> {busy === 'ai' ? 'Thinking…' : 'Ask AI'}
        </button>
      </div>

      {rows.map((r, i) => (
        <div key={r.key} className="grid gap-2 rounded-xl bg-background/40 p-2">
          <div className="flex gap-2">
            <input value={r.title} onChange={(e) => set(r.key, { title: e.target.value })} placeholder={`Part ${i + 1}`} className={field} />
            <input value={r.amount} onChange={(e) => set(r.key, { amount: e.target.value })} type="number" min="0" step="any" placeholder="Amount" className={cn(field, 'w-28 shrink-0 text-right')} />
            {rows.length > 2 && (
              <button type="button" aria-label="Remove part" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="rounded p-1 text-muted-foreground hover:bg-accent">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Picker name="_part_category" kind="category" items={cats} value={r.category} onChange={(v) => set(r.key, { category: v })} placeholder="Category" />
        </div>
      ))}

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setRows((rs) => [...rs, { key: next.current++, title: '', amount: left > 0 ? String(left) : '', category: [] }])} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Plus className="size-4" /> Add part
        </button>
        <span className={cn('tabular-nums', Math.abs(left) < 0.005 ? 'text-income' : 'text-destructive')}>
          {Math.abs(left) < 0.005 ? 'Adds up' : left > 0 ? `${left.toFixed(2)} left` : `${(-left).toFixed(2)} over`}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        disabled={busy !== null || Math.abs(left) >= 0.005}
        onClick={async () => {
          setBusy('save')
          setError(null)
          const res = await splitAction(
            id,
            rows.map((r) => ({ title: r.title, amount: r.amount, category: r.category[0] ?? '' })),
          )
          setBusy(null)
          if ('error' in res) return setError(res.error)
          router.push('/app/transactions')
          router.refresh()
        }}
        className="h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy === 'save' ? 'Splitting…' : `Split into ${rows.length} transactions`}
      </button>
    </div>
  )
}
