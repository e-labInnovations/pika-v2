'use client'

import { Check, FileUp, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { importRowsAction, parseStatementAction } from '@/app/(app)/app/actions'
import { formatMoney } from '@/lib/web/format'
import type { LookupItem } from '@/lib/web/transactions'
import type { StatementResult } from '@/utilities/statements/import'
import { cn } from '@/lib/utils'

type Draft = { include: boolean; title: string; category: string }

const field = 'h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm outline-none'

function CategorySelect({ categories, type, value, onChange }: { categories: LookupItem[]; type: string; value: string; onChange: (v: string) => void }) {
  const parents = categories.filter((c) => c.type === type && !c.parentId).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
      <option value="">Category…</option>
      {parents.map((p) => (
        <optgroup key={p.id} label={p.name}>
          {categories.filter((c) => c.parentId === p.id).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function StatementImport({ accounts, categories, currency }: { accounts: LookupItem[]; categories: LookupItem[]; currency: string }) {
  const router = useRouter()
  const [file, setFile] = React.useState<File | null>(null)
  const [password, setPassword] = React.useState('')
  const [needPassword, setNeedPassword] = React.useState(false)
  const [account, setAccount] = React.useState('')
  const [result, setResult] = React.useState<StatementResult | null>(null)
  const [drafts, setDrafts] = React.useState<Record<number, Draft>>({})
  const [busy, setBusy] = React.useState<'read' | 'import' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<number | null>(null)
  const money = (n: number | string) => formatMoney(Number(n), currency)

  const read = async () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (password) fd.append('password', password)
    if (account) fd.append('account', account)
    setBusy('read')
    setError(null)
    setDone(null)
    try {
      const res = await parseStatementAction(fd)
      if ('error' in res) {
        setError(res.error)
        if ('code' in res && (res.code === 'pdf_password_required' || res.code === 'pdf_password_wrong')) setNeedPassword(true)
        return
      }
      setResult(res.result)
      if (res.result.account) setAccount(res.result.account)
      const d: Record<number, Draft> = {}
      for (const r of res.result.rows) if (!r.match) d[r.index] = { include: true, title: r.suggestion?.title || r.payee || r.hint || '', category: r.suggestion?.category || '' }
      setDrafts(d)
    } catch {
      setError('Could not reach the server. Try a smaller PDF.')
    } finally {
      setBusy(null)
    }
  }

  const picked = result ? result.rows.filter((r) => !r.match && drafts[r.index]?.include) : []
  const ready = picked.length > 0 && picked.every((r) => drafts[r.index].category && drafts[r.index].title.trim()) && !!account

  const doImport = async () => {
    if (!result) return
    setBusy('import')
    setError(null)
    try {
      const res = await importRowsAction(
        account,
        picked.map((r) => ({
          date: r.date,
          amount: r.amount,
          type: r.type,
          title: drafts[r.index].title.trim(),
          category: drafts[r.index].category,
          tags: r.suggestion?.tags ?? [],
          person: r.suggestion?.person ?? null,
          ref: r.ref,
          particulars: r.particulars,
        })),
      )
      if ('error' in res) return setError(res.error)
      setDone(res.ids.length)
      setResult(null)
      setFile(null)
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-5">
      {done !== null && <p className="rounded-xl border border-income/40 bg-income/10 p-3 text-sm">Imported {done} transaction{done === 1 ? '' : 's'}.</p>}

      <section className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_200px_200px_auto] md:items-end">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Statement PDF
          <span className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm text-foreground">
            <FileUp className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Choose a file…'}</span>
            <input type="file" accept="application/pdf" className="absolute size-0 opacity-0" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
          </span>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Account
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
            <option value="">Detect from statement</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          PDF password {needPassword && <span className="text-destructive">(needed)</span>}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="If it has one" className="h-10 rounded-xl border bg-background px-3 text-sm" />
        </label>
        <button type="button" disabled={!file || busy !== null} onClick={read} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy === 'read' ? <Loader2 className="size-4 animate-spin" /> : null} Read
        </button>
      </section>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Period', `${result.from ?? '?'} → ${result.to ?? '?'}`],
              ['Rows', String(result.rows.length)],
              ['Already in Pika', String(result.rows.length - result.missing)],
              ['Missing', String(result.missing)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border bg-card px-4 py-3">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {!account && <p className="text-sm text-destructive">Choose the account this statement belongs to.</p>}

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2 font-medium">Add</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Statement</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.rows.map((r) => {
                  const d = drafts[r.index]
                  return (
                    <tr key={r.index} className={cn(r.match && 'text-muted-foreground', d && !d.include && 'opacity-50')}>
                      <td className="px-3 py-2">
                        {r.match ? (
                          <a href={`/app/transactions/${r.match.id}`} className="inline-flex items-center gap-1 text-xs text-income hover:underline" title={r.match.title}>
                            <Check className="size-3.5" /> In Pika
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDrafts((x) => ({ ...x, [r.index]: { ...x[r.index], include: !x[r.index].include } }))}
                            className={cn('rounded-lg border px-2 py-1 text-xs', d?.include ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground')}
                          >
                            {d?.include ? 'Adding' : 'Skip'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                      <td className="max-w-[260px] px-3 py-2">
                        <p className="truncate" title={r.particulars}>{r.payee || r.particulars}</p>
                        {r.hint && <p className="truncate text-xs text-muted-foreground">{r.hint}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {d ? <input value={d.title} onChange={(e) => setDrafts((x) => ({ ...x, [r.index]: { ...x[r.index], title: e.target.value } }))} className={field} /> : r.match?.title}
                      </td>
                      <td className="px-3 py-2">
                        {d ? <CategorySelect categories={categories} type={r.type} value={d.category} onChange={(v) => setDrafts((x) => ({ ...x, [r.index]: { ...x[r.index], category: v } }))} /> : null}
                      </td>
                      <td className={cn('px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums', r.type === 'expense' ? 'text-expense' : 'text-income')}>
                        {r.type === 'expense' ? '-' : '+'}
                        {money(r.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" disabled={!ready || busy !== null} onClick={doImport} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy === 'import' ? <Loader2 className="size-4 animate-spin" /> : null} Import {picked.length} transaction{picked.length === 1 ? '' : 's'}
            </button>
            {picked.length > 0 && !ready && <span className="text-sm text-muted-foreground">Every row being added needs a title and category.</span>}
          </div>
        </>
      )}
    </div>
  )
}
