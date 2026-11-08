'use client'

import { Archive, ArchiveRestore, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { archiveEntityAction, deleteEntityAction, saveEntityAction } from '@/app/(app)/app/actions'
import ColorPicker from '@/components/ui/color-picker'
import { Icon, IconPicker, type IconName } from '@/components/ui/icon-picker'
import type { EntityKind } from '@/lib/web/entities'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { EntityIcon } from './EntityIcon'
import { Portal } from './Portal'

export type EntityRow = {
  id: string
  name: string
  archived: boolean
  shared: boolean
  icon: string | null
  color: string | null
  bgColor: string | null
  description: string
  type: string | null
  parentId: string | null
  email: string
  phone: string
  smsIdentifiers: string
  avatarUrl: string | null
}

const SINGULAR: Record<EntityKind, string> = { categories: 'category', tags: 'tag', people: 'person', accounts: 'account' }
const TYPES = ['expense', 'income', 'transfer'] as const
const field = 'h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40'
const iconBtn = 'rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40'

export function EntityList({ kind, rows }: { kind: EntityKind; rows: EntityRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState<EntityRow | 'new' | null>(null)
  const [newParent, setNewParent] = React.useState<{ type: string; parentId: string } | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showArchived, setShowArchived] = React.useState(false)

  const act = async (id: string, fn: () => Promise<{ error: string } | object>) => {
    setBusy(id)
    setError(null)
    try {
      const res = await fn()
      if ('error' in res) setError((res as { error: string }).error)
      else router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  const live = rows.filter((r) => !r.archived)
  const old = rows.filter((r) => r.archived)

  const row = (r: EntityRow, indent = false) => (
    <li key={r.id} className={cn('flex items-center gap-3 py-2.5', indent && 'pl-10')}>
      {kind === 'people' ? <Avatar name={r.name} url={r.avatarUrl} size={32} /> : r.avatarUrl ? <Avatar name={r.name} url={r.avatarUrl} size={32} className="rounded-lg" /> : <EntityIcon icon={r.icon} color={r.color} bgColor={r.bgColor} size={32} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {r.name}
          {r.archived && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">Archived</span>}
        </p>
        {(r.description || r.email || r.phone) && <p className="truncate text-xs text-muted-foreground">{[r.email, r.phone, r.description].filter(Boolean).join(' · ')}</p>}
      </div>
      {r.shared ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Shared default, can’t be changed">
          <Lock className="size-3.5" /> Shared
        </span>
      ) : (
        <div className="flex shrink-0">
          <button type="button" title="Edit" className={iconBtn} onClick={() => setEditing(r)}>
            <Pencil className="size-4" />
          </button>
          <button type="button" title={r.archived ? 'Unarchive' : 'Archive'} disabled={busy === r.id} className={iconBtn} onClick={() => act(r.id, () => archiveEntityAction(kind, r.id, !r.archived))}>
            {r.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </button>
          <button
            type="button"
            title="Delete"
            disabled={busy === r.id}
            className={cn(iconBtn, 'hover:text-destructive')}
            onClick={() => window.confirm(`Delete "${r.name}"? This can’t be undone.`) && act(r.id, () => deleteEntityAction(kind, r.id))}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  )

  const listOf = (items: EntityRow[]) => {
    if (kind !== 'categories') return <ul className="divide-y">{items.map((r) => row(r))}</ul>
    return (
      <div className="grid gap-6">
        {TYPES.map((t) => {
          const parents = items.filter((c) => c.type === t && !c.parentId)
          const orphanKids = items.filter((c) => c.type === t && c.parentId && !rows.some((p) => p.id === c.parentId))
          if (!parents.length && !orphanKids.length) return null
          return (
            <div key={t}>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t}</h3>
              <ul className="divide-y">
                {parents.map((p) => (
                  <React.Fragment key={p.id}>
                    {row(p)}
                    {rows.filter((c) => c.parentId === p.id && items.includes(c)).map((c) => row(c, true))}
                    <li className="py-1.5 pl-10">
                      <button type="button" onClick={() => { setNewParent({ type: t, parentId: p.id }); setEditing('new') }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <Plus className="size-3.5" /> Add subcategory
                      </button>
                    </li>
                  </React.Fragment>
                ))}
                {orphanKids.map((c) => row(c, true))}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{live.length} {kind}</p>
        <button type="button" onClick={() => { setNewParent(null); setEditing('new') }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" /> New {SINGULAR[kind]}
        </button>
      </div>
      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="rounded-2xl border bg-card px-5 py-2">{live.length ? listOf(live) : <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}</div>
      {old.length > 0 && (
        <div className="rounded-2xl border bg-card px-5 py-3">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Archived ({old.length}) {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && <div className="opacity-75">{listOf(old)}</div>}
        </div>
      )}
      {editing && (
        <Portal>
          <EntityForm
            kind={kind}
            row={editing === 'new' ? null : editing}
            parents={rows.filter((r) => r.type && !r.parentId && !r.archived)}
            preset={editing === 'new' ? newParent : null}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              router.refresh()
            }}
          />
        </Portal>
      )}
    </div>
  )
}

function EntityForm({
  kind,
  row,
  parents,
  preset,
  onClose,
  onSaved,
}: {
  kind: EntityKind
  row: EntityRow | null
  parents: EntityRow[]
  preset: { type: string; parentId: string } | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(row?.name ?? '')
  const [description, setDescription] = React.useState(row?.description ?? '')
  const [icon, setIcon] = React.useState(row?.icon ?? (kind === 'accounts' ? 'wallet' : kind === 'tags' ? 'tag' : 'shapes'))
  const [color, setColor] = React.useState(row?.color ?? '#FFFFFF')
  const [bgColor, setBgColor] = React.useState(row?.bgColor ?? '#3B82F6')
  const [type, setType] = React.useState(row?.type ?? preset?.type ?? 'expense')
  const [parent, setParent] = React.useState(row?.parentId ?? preset?.parentId ?? '')
  const [email, setEmail] = React.useState(row?.email ?? '')
  const [phone, setPhone] = React.useState(row?.phone ?? '')
  const [sms, setSms] = React.useState(row?.smsIdentifiers ?? '')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const styled = kind !== 'people'

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: Record<string, unknown> = { name, description }
    if (styled) Object.assign(data, { icon, color, bgColor })
    if (kind === 'categories') Object.assign(data, { parent: parent || null, ...(row ? {} : { type }) })
    if (kind === 'people') Object.assign(data, { email, phone })
    if (kind === 'accounts') data.smsIdentifiers = sms
    setBusy(true)
    setError(null)
    try {
      const res = await saveEntityAction(kind, row?.id ?? null, data)
      if ('error' in res) setError(res.error)
      else onSaved()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{row ? `Edit ${SINGULAR[kind]}` : `New ${SINGULAR[kind]}`}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={save} className="grid gap-3">
          {styled && (
            <div className="flex items-center gap-3">
              <EntityIcon icon={icon} color={color} bgColor={bgColor} size={48} />
              <p className="text-sm text-muted-foreground">Preview</p>
            </div>
          )}
          <label className="grid gap-1 text-xs text-muted-foreground">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={field} />
          </label>
          {kind === 'categories' && (
            <>
              <div className="grid grid-cols-3 gap-1 rounded-xl border bg-background p-1">
                {TYPES.map((t) => (
                  <button key={t} type="button" disabled={!!row} onClick={() => { setType(t); setParent('') }} className={cn('h-9 rounded-lg text-sm capitalize', t === type ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent', row && 'cursor-not-allowed')}>
                    {t}
                  </button>
                ))}
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Parent (leave empty for a top-level category)
                <select value={parent} onChange={(e) => setParent(e.target.value)} className={field}>
                  <option value="">— Top level —</option>
                  {parents.filter((p) => p.type === type && p.id !== row?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.shared ? ' (shared)' : ''}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {styled && (
            <>
              <div className="grid gap-1 text-xs text-muted-foreground">
                Icon
                <IconPicker value={icon as IconName} onValueChange={(v) => setIcon(v)} searchable categorized>
                  <button type="button" className={cn(field, 'flex items-center gap-2 text-left text-foreground')}>
                    <Icon name={icon as IconName} size={15} className="shrink-0 opacity-70" />
                    <span className="truncate">{icon}</span>
                  </button>
                </IconPicker>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1 text-xs text-muted-foreground">
                  Background
                  <ColorPicker color={bgColor} setColor={setBgColor} />
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  Icon colour
                  <ColorPicker color={color} setColor={setColor} />
                </div>
              </div>
            </>
          )}
          {kind === 'people' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
              </label>
            </div>
          )}
          {kind === 'accounts' && (
            <label className="grid gap-1 text-xs text-muted-foreground">
              SMS identifiers (last 4 digits or keywords, comma-separated)
              <input value={sms} onChange={(e) => setSms(e.target.value)} placeholder="X6623, Pluxee" className={field} />
            </label>
          )}
          <label className="grid gap-1 text-xs text-muted-foreground">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      </aside>
    </div>
  )
}
