'use client'

import { Users, X } from 'lucide-react'
import React from 'react'

import { evenShares, myShare } from '@/lib/web/shares'
import type { LookupItem } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { Picker } from './Picker'

export type ShareRow = { person: string; amount: string }

/**
 * "Split with people" for an expense: pick friends, split evenly (I take the
 * rounding) or type each share. Submits share_person / share_amount pairs.
 */
export function SharesEditor({ people, total, value, onChange }: { people: LookupItem[]; total: number; value: ShareRow[]; onChange: (rows: ShareRow[]) => void }) {
  const [open, setOpen] = React.useState(value.length > 0)
  // Even mode only if the saved shares already are even, so editing never rewrites custom amounts.
  const [even, setEven] = React.useState(
    () => value.length === 0 || evenShares(total || 0, value.length).join() === value.map((r) => Number(r.amount).toFixed(2)).join(),
  )
  const byId = new Map(people.map((p) => [p.id, p]))

  // Even split follows the amount and the people picked.
  React.useEffect(() => {
    if (!even || !value.length) return
    const amounts = evenShares(total || 0, value.length)
    if (amounts.some((a, i) => a !== value[i].amount)) onChange(value.map((r, i) => ({ ...r, amount: amounts[i] })))
  }, [even, total, value, onChange])

  const mine = myShare(total || 0, value.map((r) => r.amount || 0))
  const over = Number(mine) < 0

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 justify-self-start rounded-xl border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
        <Users className="size-4" /> Split with people
      </button>
    )
  }

  return (
    <div className="grid gap-2 rounded-xl border p-3">
      <input type="hidden" name="shares_present" value="1" />
      {value.map((r) => (
        <React.Fragment key={r.person}>
          <input type="hidden" name="share_person" value={r.person} />
          <input type="hidden" name="share_amount" value={r.amount} />
        </React.Fragment>
      ))}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold tracking-wide uppercase">Split with</span>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {[true, false].map((e) => (
            <button key={String(e)} type="button" onClick={() => setEven(e)} className={cn('rounded-md px-2 py-0.5', even === e && 'bg-primary/15 text-primary')}>
              {e ? 'Evenly' : 'Amounts'}
            </button>
          ))}
        </div>
      </div>
      <Picker
        name="_share_pick"
        kind="person"
        items={people}
        value={value.map((r) => r.person)}
        onChange={(ids) => onChange(ids.map((id) => value.find((r) => r.person === id) ?? { person: id, amount: '' }))}
        placeholder="Choose people"
        multiple
      />
      {value.map((r) => {
        const p = byId.get(r.person)
        return (
          <div key={r.person} className="flex items-center gap-2 text-sm">
            <Avatar name={p?.name ?? '?'} url={p?.avatarUrl} size={24} />
            <span className="min-w-0 flex-1 truncate">{p?.name ?? 'Someone'}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={r.amount}
              readOnly={even}
              onChange={(e) => onChange(value.map((x) => (x.person === r.person ? { ...x, amount: e.target.value } : x)))}
              className={cn('h-8 w-28 min-w-0 rounded-lg border bg-background px-2 text-right text-sm tabular-nums', even && 'opacity-70')}
            />
            <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x.person !== r.person))} className="rounded p-1 text-muted-foreground hover:bg-accent">
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
      <div className={cn('flex justify-between border-t pt-2 text-sm', over && 'text-destructive')}>
        <span>{over ? 'Shares are more than the amount' : 'Your share'}</span>
        <span className="font-semibold tabular-nums">{mine}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          onChange([])
          setOpen(false)
        }}
        className="justify-self-start text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Don&apos;t split
      </button>
    </div>
  )
}
