'use client'

import React, { useActionState } from 'react'

import { saveTransaction, type ActionState } from '@/app/(app)/app/actions'
import type { LookupItem } from '@/lib/web/transactions'

export type EditValues = {
  id: string
  type: string
  title: string
  note: string
  amount: string
  date: string
  category: string | null
  account: string | null
  person: string | null
  tags: string[]
}

const field = 'h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

/** Archived options are hidden unless already chosen (same rule as the phone app's pickers). */
const offer = (items: LookupItem[], keep: (string | null)[]) => items.filter((i) => !i.archived || keep.includes(i.id))

export function EditTxForm({
  values,
  lists,
  onDone,
}: {
  values: EditValues
  lists: { categories: LookupItem[]; tags: LookupItem[]; people: LookupItem[]; accounts: LookupItem[] }
  onDone: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTransaction, null)
  React.useEffect(() => {
    if (state && 'ok' in state) onDone()
  }, [state, onDone])

  const byId = new Map(lists.categories.map((c) => [c.id, c]))
  const cats = offer(
    lists.categories.filter((c) => c.parentId && c.type === values.type),
    [values.category],
  ).map((c) => ({ ...c, label: `${byId.get(c.parentId!)?.name ?? ''} › ${c.name}` }))

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={values.id} />
      <label className="grid gap-1 text-xs text-muted-foreground">
        Title
        <input name="title" defaultValue={values.title} required className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" defaultValue={values.amount} required className={field} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Date
          <input name="date" type="datetime-local" defaultValue={values.date} required className={field} />
        </label>
      </div>
      {values.type !== 'transfer' && (
        <label className="grid gap-1 text-xs text-muted-foreground">
          Category
          <select name="category" defaultValue={values.category ?? ''} className={field}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Account
          <select name="account" defaultValue={values.account ?? ''} className={field}>
            {offer(lists.accounts, [values.account]).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Person
          <select name="person" defaultValue={values.person ?? ''} className={field}>
            <option value="">—</option>
            {offer(lists.people, [values.person]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="grid gap-1 text-xs text-muted-foreground">
        Tags
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border bg-background p-2">
          {offer(lists.tags, values.tags).map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/15">
              <input type="checkbox" name="tags" value={t.id} defaultChecked={values.tags.includes(t.id)} className="sr-only" />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Note
        <textarea name="note" defaultValue={values.note} rows={3} className={`${field} h-auto py-2`} />
      </label>
      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone} className="h-10 rounded-xl border px-4 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
