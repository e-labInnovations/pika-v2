'use client'

import { Check, ChevronDown, X } from 'lucide-react'
import React from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { EntityIcon } from './EntityIcon'

export type PickerKind = 'category' | 'account' | 'person' | 'tag'

function ItemIcon({ item, kind, size = 22 }: { item: LookupItem; kind: PickerKind; size?: number }) {
  if (kind === 'person') return <Avatar name={item.name} url={item.avatarUrl} size={size} />
  if (item.avatarUrl) return <Avatar name={item.name} url={item.avatarUrl} size={size} className="rounded-md" />
  return <EntityIcon icon={item.icon} color={item.color} bgColor={item.bgColor} size={size} className="rounded-md" />
}

const trigger =
  'flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border bg-background px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

/**
 * Searchable picker for a form. Categories are grouped under their parent (only
 * subcategories can be picked). Submits through hidden inputs named `name`.
 */
export function Picker({
  name,
  kind,
  items,
  value,
  onChange,
  placeholder = 'Choose…',
  allowNone,
  multiple,
}: {
  name: string
  kind: PickerKind
  items: LookupItem[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  /** Single-select: offer an empty choice (e.g. no person). */
  allowNone?: boolean
  multiple?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const term = q.trim().toLowerCase()
  const parentName = (i: LookupItem) => (i.parentId ? byId.get(i.parentId)?.name ?? '' : '')
  const choosable = items.filter((i) => (kind !== 'category' || i.parentId) && (!term || i.name.toLowerCase().includes(term) || parentName(i).toLowerCase().includes(term)))

  const pick = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
    else {
      onChange(id ? [id] : [])
      setOpen(false)
      setQ('')
    }
  }

  const row = (i: LookupItem) => {
    const on = value.includes(i.id)
    return (
      <button
        key={i.id}
        type="button"
        onClick={() => pick(i.id)}
        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent', on && 'bg-primary/15 text-primary hover:bg-primary/20')}
      >
        <ItemIcon item={i} kind={kind} />
        <span className="min-w-0 flex-1 truncate">{i.name}</span>
        {on && <Check className="size-4 shrink-0" />}
      </button>
    )
  }

  // Categories: parent headings with their subcategories.
  const groups =
    kind === 'category'
      ? [...new Set(choosable.map((c) => c.parentId!))]
          .map((pid) => ({ parent: byId.get(pid), kids: choosable.filter((c) => c.parentId === pid).sort((a, b) => a.name.localeCompare(b.name)) }))
          .sort((a, b) => (a.parent?.name ?? '').localeCompare(b.parent?.name ?? ''))
      : null

  const selected = value.map((id) => byId.get(id)).filter((x): x is LookupItem => !!x)

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }}>
      {value.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {!multiple && value.length === 0 && <input type="hidden" name={name} value="" />}
      <PopoverTrigger asChild>
        <button type="button" className={cn(trigger, multiple && selected.length > 0 && 'h-auto min-h-10 flex-wrap py-1.5')}>
          {multiple ? (
            selected.length ? (
              selected.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: t.bgColor || 'var(--muted)', color: t.color || 'inherit' }}>
                  {t.name}
                  <X
                    className="size-3 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      pick(t.id)
                    }}
                  />
                </span>
              ))
            ) : (
              <span className="flex-1 text-muted-foreground">{placeholder}</span>
            )
          ) : selected[0] ? (
            <>
              <ItemIcon item={selected[0]} kind={kind} size={22} />
              <span className="min-w-0 flex-1 truncate">
                {kind === 'category' && selected[0].parentId ? <span className="text-muted-foreground">{parentName(selected[0])} › </span> : null}
                {selected[0].name}
              </span>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="mb-2 h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none"
        />
        <div className="max-h-72 overflow-y-auto">
          {allowNone && !multiple && !term && (
            <button type="button" onClick={() => pick('')} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent', value.length === 0 && 'bg-primary/15 text-primary')}>
              None
            </button>
          )}
          {groups
            ? groups.map((g, gi) => (
                <div key={g.parent?.id ?? 'none'} role="group" aria-label={g.parent?.name ?? 'Other'} className={cn(gi > 0 && 'mt-1 border-t pt-1')}>
                  {/* Heading only: a parent category can't be picked. */}
                  <p className="sticky top-0 z-10 flex cursor-default items-center gap-2 bg-popover px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase select-none">
                    {g.parent && <EntityIcon icon={g.parent.icon} color={g.parent.color} bgColor={g.parent.bgColor} size={16} className="rounded" />}
                    {g.parent?.name ?? 'Other'}
                  </p>
                  <div className="ml-4 border-l pl-2">{g.kids.map(row)}</div>
                </div>
              ))
            : [...choosable].sort((a, b) => a.name.localeCompare(b.name)).map(row)}
          {choosable.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nothing found.</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
