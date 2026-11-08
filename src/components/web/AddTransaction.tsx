'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useActionState } from 'react'

import { addTransaction, getAddFormLists, type AddState } from '@/app/(app)/app/actions'
import type { LookupItem } from '@/lib/web/transactions'
import type { Prefill } from '@/lib/web/prefill'
import { cn } from '@/lib/utils'
import { AttachmentsEditor, type Attachment } from './AttachmentsEditor'
import { AiFill } from './AiFill'
import { Picker } from './Picker'
import { SharesEditor, type ShareRow } from './SharesEditor'
import { Portal } from './Portal'

type Lists = { categories: LookupItem[]; tags: LookupItem[]; people: LookupItem[]; accounts: LookupItem[] }
type TxType = 'expense' | 'income' | 'transfer'

const field = 'h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'
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
  const [category, setCategory] = React.useState<string[]>([])
  const [account, setAccount] = React.useState<string[]>([])
  const [toAccount, setToAccount] = React.useState<string[]>([])
  const [person, setPerson] = React.useState<string[]>([])
  const [tags, setTags] = React.useState<string[]>([])
  const [amount, setAmount] = React.useState('')
  const [shares, setShares] = React.useState<ShareRow[]>([])
  const [files, setFiles] = React.useState<Attachment[]>([])
  const [title, setTitle] = React.useState('')
  const [date, setDate] = React.useState(nowLocal)
  const [note, setNote] = React.useState('')
  // Bumped on AI fill so the shares editor remounts open with the AI's split.
  const [fillKey, setFillKey] = React.useState(0)

  const fill = (p: Prefill) => {
    setType(p.type)
    if (p.title) setTitle(p.title)
    if (p.amount) setAmount(p.amount)
    if (p.date) setDate(p.date)
    setCategory(p.category ? [p.category] : [])
    if (p.account) setAccount([p.account])
    setToAccount(p.toAccount ? [p.toAccount] : [])
    setPerson(p.person ? [p.person] : [])
    setTags(p.tags)
    setShares(p.shares)
    if (p.note) setNote(p.note)
    setFillKey((k) => k + 1)
  }
  const [state, action, pending] = useActionState<AddState, FormData>(addTransaction, null)

  React.useEffect(() => {
    getAddFormLists()
      .then((l) => {
        setLists(l)
        if (l.accounts[0]) setAccount([l.accounts[0].id])
      })
      .catch(() => setLists({ categories: [], tags: [], people: [], accounts: [] }))
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

  // Subcategories of this type, plus their parents for the group headings.
  const typeCats = (lists?.categories ?? []).filter((c) => c.type === type)

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
            <AiFill onFill={fill} />
            <input type="hidden" name="type" value={type} />
            <div className="grid grid-cols-3 gap-1 rounded-xl border bg-background p-1">
              {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    setCategory([])
                  }}
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
              <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Lunch at Paragon" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Amount
                <input name="amount" type="number" min="0" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Date
                <input name="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required className={field} />
              </label>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground">
              Category
              <Picker name="category" kind="category" items={typeCats} value={category} onChange={setCategory} placeholder="Choose a category" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                {type === 'transfer' ? 'From account' : 'Account'}
                <Picker name="account" kind="account" items={lists.accounts} value={account} onChange={setAccount} />
              </div>
              {type === 'transfer' ? (
                <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                  To account
                  <Picker name="toAccount" kind="account" items={lists.accounts.filter((x) => !account.includes(x.id))} value={toAccount} onChange={setToAccount} />
                </div>
              ) : (
                <div className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                  Person
                  <Picker name="person" kind="person" items={lists.people} value={person} onChange={setPerson} placeholder="No one" allowNone />
                </div>
              )}
            </div>
            {type === 'expense' && <SharesEditor key={fillKey} people={lists.people} total={Number(amount) || 0} value={shares} onChange={setShares} />}
            {lists.tags.length > 0 && (
              <div className="grid gap-1 text-xs text-muted-foreground">
                Tags
                <Picker name="tags" kind="tag" items={lists.tags} value={tags} onChange={setTags} placeholder="Add tags" multiple />
              </div>
            )}
            <AttachmentsEditor value={files} onChange={setFiles} />
            <label className="grid gap-1 text-xs text-muted-foreground">
              Note
              <textarea name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${field} h-auto py-2`} />
            </label>
            {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
            {state && 'duplicate' in state && (
              <div className="grid gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p>
                  Looks like one you already have: <strong>{state.duplicate.title}</strong>, {state.duplicate.amount} on {state.duplicate.when}.
                </p>
                <div className="flex gap-2">
                  <button type="submit" name="allow_duplicate" value="1" disabled={pending} className="h-9 rounded-lg bg-amber-500 px-3 font-semibold text-black disabled:opacity-60">
                    Add anyway
                  </button>
                  <a href={`/app/transactions/${state.duplicate.id}`} className="inline-flex h-9 items-center rounded-lg border px-3 hover:bg-accent">
                    Open it
                  </a>
                </div>
              </div>
            )}
            <button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {pending ? 'Adding…' : 'Add transaction'}
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
