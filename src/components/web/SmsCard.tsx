'use client'

import { Check, Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { confirmSmsAction, dismissSmsAction } from '@/app/(app)/app/actions'
import { formatMoney } from '@/lib/web/format'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { Picker } from './Picker'

type Lists = { categories: LookupItem[]; tags: LookupItem[]; people: LookupItem[]; accounts: LookupItem[] }

export type SmsView = {
  id: string
  body: string
  sender: string
  when: string
  type: 'expense' | 'income' | 'transfer'
  amount: string
  merchant: string | null
  account: string | null
  title: string
  category: string | null
  tags: string[]
  person: string | null
  toAccount: string | null
  parts: { title: string; amount: string; category: string | null }[]
  duplicate: { id: string; title: string; amount: string; when: string } | null
}

const field = 'h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'

export function SmsCard({ sms, lists, currency }: { sms: SmsView; lists: Lists; currency: string }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState(sms.title)
  const [category, setCategory] = React.useState<string[]>(sms.category ? [sms.category] : [])
  const [account, setAccount] = React.useState<string[]>(sms.account ? [sms.account] : [])
  const [toAccount, setToAccount] = React.useState<string[]>(sms.toAccount ? [sms.toAccount] : [])
  const [person, setPerson] = React.useState<string[]>(sms.person ? [sms.person] : [])
  const [tags, setTags] = React.useState<string[]>(sms.tags)
  const [note, setNote] = React.useState('')

  const byId = new Map(lists.categories.map((c) => [c.id, c]))
  const catName = (id: string | null) => {
    const c = id ? byId.get(id) : null
    return c ? `${c.parentId ? `${byId.get(c.parentId)?.name ?? ''} › ` : ''}${c.name}` : 'No category'
  }

  const run = async (fn: () => Promise<{ error: string } | object>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if ('error' in res) return setError((res as { error: string }).error)
      router.refresh()
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const confirmEdited = () =>
    run(() =>
      confirmSmsAction(sms.id, {
        parts: [],
        title: title.trim() || sms.title,
        ...(category[0] ? { category: category[0] } : {}),
        ...(account[0] ? { account: account[0] } : {}),
        ...(sms.type === 'transfer' ? { toAccount: toAccount[0] ?? null } : { person: person[0] ?? null }),
        tags,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    )

  return (
    <div className="grid content-start gap-3 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{sms.merchant || sms.title || 'Bank SMS'}</p>
          <p className="text-xs text-muted-foreground">{sms.when} · {sms.sender}</p>
        </div>
        <p className={cn('shrink-0 text-lg font-bold tabular-nums', sms.type === 'expense' ? 'text-expense' : sms.type === 'income' ? 'text-income' : '')}>
          {sms.type === 'expense' ? '-' : sms.type === 'income' ? '+' : ''}
          {formatMoney(Number(sms.amount), currency)}
        </p>
      </div>
      <p className="rounded-xl bg-background/50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{sms.body}</p>

      {sms.duplicate && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
          Maybe already added: <a href={`/app/transactions/${sms.duplicate.id}`} className="font-semibold underline">{sms.duplicate.title}</a>, {sms.duplicate.amount} on {sms.duplicate.when}.
        </p>
      )}

      {!editing ? (
        sms.parts.length > 1 ? (
          <div className="grid gap-1 rounded-xl border p-3 text-sm">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Suggested split</p>
            {sms.parts.map((x, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{x.title} <span className="text-muted-foreground">· {catName(x.category)}</span></span>
                <span className="shrink-0 tabular-nums">{formatMoney(Number(x.amount), currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-0.5 rounded-xl border p-3 text-sm">
            <p className="font-medium">{sms.title || '—'}</p>
            <p className="text-xs text-muted-foreground">{catName(sms.category)}{sms.tags.length ? ` · ${sms.tags.length} tag${sms.tags.length > 1 ? 's' : ''}` : ''}</p>
          </div>
        )
      ) : (
        <div className="grid gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={field} />
          <Picker name="_c" kind="category" items={lists.categories.filter((c) => c.type === sms.type)} value={category} onChange={setCategory} placeholder="Category" />
          <div className="grid grid-cols-2 gap-2">
            <Picker name="_a" kind="account" items={lists.accounts} value={account} onChange={setAccount} placeholder="Account" />
            {sms.type === 'transfer' ? (
              <Picker name="_t" kind="account" items={lists.accounts.filter((a) => !account.includes(a.id))} value={toAccount} onChange={setToAccount} placeholder="To account" />
            ) : (
              <Picker name="_p" kind="person" items={lists.people} value={person} onChange={setPerson} placeholder="No one" allowNone />
            )}
          </div>
          <Picker name="_g" kind="tag" items={lists.tags} value={tags} onChange={setTags} placeholder="Tags" multiple />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={field} />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button type="button" disabled={busy} onClick={confirmEdited} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              <Check className="size-4" /> Confirm
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border px-3 text-sm">Cancel</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => confirmSmsAction(sms.id, {}))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              <Check className="size-4" /> {sms.parts.length > 1 ? `Confirm ${sms.parts.length} parts` : 'Confirm'}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent">
              <Pencil className="size-4" /> {sms.parts.length > 1 ? 'As one, edit' : 'Edit & confirm'}
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => dismissSmsAction(sms.id))} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-4" /> Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}
