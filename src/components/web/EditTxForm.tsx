'use client'

import React, { useActionState } from 'react'

import { saveTransaction, type ActionState } from '@/app/(app)/app/actions'
import type { LookupItem } from '@/lib/web/transactions'
import { Picker } from './Picker'

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

const field = 'h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

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

  // The current category is always offered, even if it wouldn't be picked today
  // (archived, another type), so saving can't silently swap it.
  const catItems = lists.categories.filter(
    (c) => (c.type === values.type && (!c.archived || c.id === values.category)) || c.id === values.category,
  )
  const [category, setCategory] = React.useState<string[]>(values.category ? [values.category] : [])
  const [account, setAccount] = React.useState<string[]>(values.account ? [values.account] : [])
  const [person, setPerson] = React.useState<string[]>(values.person ? [values.person] : [])
  const [tags, setTags] = React.useState<string[]>(values.tags)

  return (
    <form action={action} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="id" value={values.id} />
      <label className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        Title
        <input name="title" defaultValue={values.title} required className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          Amount
          <input name="amount" type="number" min="0" step="any" defaultValue={values.amount} required className={field} />
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          Date
          <input name="date" type="datetime-local" defaultValue={values.date} required className={field} />
        </label>
      </div>
      {values.type !== 'transfer' && (
        <div className="grid gap-1 text-xs text-muted-foreground">
          Category
          <Picker name="category" kind="category" items={catItems} value={category} onChange={setCategory} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          Account
          <Picker name="account" kind="account" items={offer(lists.accounts, [values.account])} value={account} onChange={setAccount} />
        </div>
        {values.type !== 'transfer' && (
          <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
            Person
            <Picker name="person" kind="person" items={offer(lists.people, [values.person])} value={person} onChange={setPerson} placeholder="No one" allowNone />
          </div>
        )}
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        Tags
        <Picker name="tags" kind="tag" items={offer(lists.tags, values.tags)} value={tags} onChange={setTags} placeholder="Add tags" multiple />
      </div>
      <label className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
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
