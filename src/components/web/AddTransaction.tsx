'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useActionState } from 'react'

import { addTransaction, getAddFormLists, type AddState } from '@/app/(app)/app/actions'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { Portal } from './Portal'

type Lists = { categories: LookupItem[]; tags: LookupItem[]; people: LookupItem[]; accounts: LookupItem[] }
type TxType = 'expense' | 'income' | 'transfer'

const field = 'h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'
const pad = (n: number) => String(n).padStart(2, '0')
const nowLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Top-bar button: a side panel with the add form. */
export function AddTransaction() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
        <Plus className="size-4" />
        <span className="hidden sm:inline">Add</span>
      </button>
      {open && (
        <Portal>
          <AddPanel onClose={() => setOpen(false)} />
        </Portal>
      )}
    </>
  )
}

function AddPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [lists, setLists] = React.useState<Lists | null>(null)
  const [type, setType] = React.useState<TxType>('expense')
  const [state, action, pending] = useActionState<AddState, FormData>(addTransaction, null)

  React.useEffect(() => {
    getAddFormLists().then(setLists).catch(() => setLists({ categories: [], tags: [], people: [], accounts: [] }))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  React.useEffect(() => {
    if (state && 'ok' in state) {
      onClose()
      router.refresh()
    }
  }, [state, onClose, router])

  const byId = new Map((lists?.categories ?? []).map((c) => [c.id, c]))
  const cats = (lists?.categories ?? [])
    .filter((c) => c.parentId && c.type === type)
    .map((c) => ({ id: c.id, label: `${byId.get(c.parentId!)?.name ?? ''} › ${c.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add transaction</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
        {!lists ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="type" value={type} />
            <div className="grid grid-cols-3 gap-1 rounded-xl border bg-background p-1">
              {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'h-9 rounded-lg text-sm font-medium capitalize',
                    t === type ? (t === 'expense' ? 'bg-expense/20 text-expense' : t === 'income' ? 'bg-income/20 text-income' : 'bg-primary/20 text-primary') : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Title
              <input name="title" required autoFocus className={field} placeholder="Lunch at Paragon" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Amount
                <input name="amount" type="number" min="0" step="any" required className={field} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Date
                <input name="date" type="datetime-local" defaultValue={nowLocal()} required className={field} />
              </label>
            </div>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Category
              <select key={type} name="category" required defaultValue="" className={field}>
                <option value="" disabled>Choose…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                {type === 'transfer' ? 'From account' : 'Account'}
                <select name="account" required defaultValue={lists.accounts[0]?.id ?? ''} className={field}>
                  {lists.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              {type === 'transfer' ? (
                <label className="grid gap-1 text-xs text-muted-foreground">
                  To account
                  <select name="toAccount" required defaultValue="" className={field}>
                    <option value="" disabled>Choose…</option>
                    {lists.accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Person
                  <select name="person" defaultValue="" className={field}>
                    <option value="">—</option>
                    {lists.people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {lists.tags.length > 0 && (
              <fieldset className="grid gap-1 text-xs text-muted-foreground">
                Tags
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border bg-background p-2">
                  {lists.tags.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/15">
                      <input type="checkbox" name="tags" value={t.id} className="sr-only" />
                      {t.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="grid gap-1 text-xs text-muted-foreground">
              Note
              <textarea name="note" rows={2} className={`${field} h-auto py-2`} />
            </label>
            {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
            <button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {pending ? 'Adding…' : 'Add transaction'}
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
