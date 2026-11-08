'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { deleteBudgetAction, saveBudgetAction } from '@/app/(app)/app/actions'
import { formatMoney } from '@/lib/web/format'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { EntityIcon } from './EntityIcon'

type Budget = { id: string; category: string; name: string; icon: string | null; color: string | null; bgColor: string | null; amount: number; spent: number; percent: number; status: 'ok' | 'warn' | 'over'; archived: boolean }

const field = 'h-10 min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

/** Expense categories as <optgroup>s: a parent (its whole group) and its subcategories. */
function CategorySelect({ categories, value, onChange, taken }: { categories: LookupItem[]; value: string; onChange: (v: string) => void; taken: Set<string> }) {
  const parents = categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(field, 'w-full')}>
      <option value="" disabled>Choose a category…</option>
      {parents.map((p) => (
        <optgroup key={p.id} label={p.name}>
          <option value={p.id} disabled={taken.has(p.id)}>All of {p.name}</option>
          {categories.filter((c) => c.parentId === p.id).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id} disabled={taken.has(c.id)}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function BudgetsEditor({ budgets, categories, currency }: { budgets: Budget[]; categories: LookupItem[]; currency: string }) {
  const router = useRouter()
  const [adding, setAdding] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const taken = new Set(budgets.map((b) => b.category))
  const money = (n: number) => formatMoney(n, currency)

  const run = async (fn: () => Promise<{ error: string } | object>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if ('error' in res) setError((res as { error: string }).error)
      else {
        after?.()
        router.refresh()
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {budgets.map((b) => (
          <div key={b.id} className={cn('grid gap-3 rounded-2xl border bg-card p-5', b.archived && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <EntityIcon icon={b.icon} color={b.color} bgColor={b.bgColor} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}{b.archived ? ' · Archived' : ''}</p>
                <p className="text-xs text-muted-foreground">{money(b.spent)} of {money(b.amount)} this month</p>
              </div>
              <button type="button" title="Change limit" onClick={() => { setEditing(b.id); setAmount(String(b.amount)) }} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Pencil className="size-4" />
              </button>
              <button type="button" title="Remove budget" disabled={busy} onClick={() => window.confirm(`Remove the ${b.name} budget?`) && run(() => deleteBudgetAction(b.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', b.status === 'over' ? 'bg-expense' : b.status === 'warn' ? 'bg-amber-500' : 'bg-income')} style={{ width: `${Math.min(100, b.percent)}%` }} />
            </div>
            {editing === b.id && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(() => saveBudgetAction(b.id, b.category, Number(amount)), () => setEditing(null))
                }}
              >
                <input autoFocus type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(field, 'flex-1')} />
                <button type="submit" disabled={busy} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="h-10 rounded-xl border px-3 text-sm">Cancel</button>
              </form>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <form
          className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => saveBudgetAction(null, category, Number(amount)), () => {
              setAdding(false)
              setCategory('')
              setAmount('')
            })
          }}
        >
          <CategorySelect categories={categories} value={category} onChange={setCategory} taken={taken} />
          <input type="number" min="1" step="1" required placeholder="Monthly limit" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !category} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-xl border px-3 text-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setAmount('') }} className="inline-flex h-10 items-center gap-2 justify-self-start rounded-xl border px-4 text-sm hover:bg-accent">
          <Plus className="size-4" /> Add a budget
        </button>
      )}
    </div>
  )
}
