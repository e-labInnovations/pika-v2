'use client'

import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { createMcpKeyAction, deleteMcpKeyAction, setMcpKeyEnabledAction } from '@/app/(app)/app/actions'
import type { McpKeyRow } from '@/lib/web/mcpKeys'
import { cn } from '@/lib/utils'

function CopyText({ text }: { text: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-sm">{text}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {})
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-accent"
      >
        {done ? <Check className="size-3.5 text-income" /> : <Copy className="size-3.5" />} {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function McpKeys({ keys, server }: { keys: McpKeyRow[]; server: string }) {
  const router = useRouter()
  const [label, setLabel] = React.useState('')
  const [fresh, setFresh] = React.useState<{ label: string; key: string } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const run = async (fn: () => Promise<{ error: string } | object>, after?: (res: object) => void) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if ('error' in res) setError((res as { error: string }).error)
      else {
        after?.(res)
        router.refresh()
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid max-w-3xl gap-5">
      <section className="grid gap-2 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Server</h2>
        <CopyText text={server} />
        <p className="text-xs text-muted-foreground">ChatGPT connects to this URL and signs in with your Pika account, no key needed. Other clients (Claude Desktop, scripts) use a key below as a Bearer token.</p>
      </section>

      {fresh && (
        <section className="grid gap-2 rounded-2xl border border-income/40 bg-income/10 p-5">
          <p className="text-sm font-semibold">Key “{fresh.label}” created: copy it now, it won’t be shown again.</p>
          <CopyText text={fresh.key} />
        </section>
      )}

      <section className="grid gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Keys</h2>
        {keys.length === 0 && <p className="text-sm text-muted-foreground">No keys yet.</p>}
        <ul className="divide-y">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-3">
              <KeyRound className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', !k.enabled && 'text-muted-foreground line-through')}>{k.label}</p>
                <p className="text-xs text-muted-foreground">Created {new Date(k.createdAt).toLocaleDateString()}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => run(() => setMcpKeyEnabledAction(k.id, !k.enabled))} className="h-8 rounded-lg border px-3 text-xs hover:bg-accent">
                {k.enabled ? 'Disable' : 'Enable'}
              </button>
              <button type="button" disabled={busy} title="Delete" onClick={() => window.confirm(`Delete the key "${k.label}"? Clients using it stop working.`) && run(() => deleteMcpKeyAction(k.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = label
            void run(() => createMcpKeyAction(name), (res) => {
              setFresh({ label: name, key: (res as { apiKey: string }).apiKey })
              setLabel('')
            })
          }}
        >
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New key name, e.g. Claude Desktop" className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none" />
          <button type="submit" disabled={busy || !label.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Plus className="size-4" /> Create key
          </button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  )
}
