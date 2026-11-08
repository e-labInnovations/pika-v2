import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import React from 'react'

import type { Media, Transaction, TransactionLink, User } from '@/payload-types'
import { formatLocalDateTime, formatMoney, formatSigned, localInputValue } from '@/lib/web/format'
import { requireSession } from '@/lib/session'
import { loadLookups } from '@/lib/web/transactions'
import { cn } from '@/lib/utils'
import { EntityIcon } from './EntityIcon'
import { amountClass } from './TxList'
import { TxEditToggle } from './TxEditToggle'

type Rel = { id: string; name?: string | null; icon?: string | null; color?: string | null; bgColor?: string | null }
const rel = (v: unknown): Rel | null => (v && typeof v === 'object' ? (v as Rel) : null)
const idOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

const LINK_LABEL: Record<TransactionLink['type'], string> = { repaid: 'Repaid', returned: 'Returned', duplicate: 'Duplicate', correction: 'Correction' }

/** The user's transaction, or a 404 (access control hides everyone else's). */
export async function loadTransaction(payload: Payload, user: User, id: string): Promise<Transaction> {
  try {
    return (await payload.findByID({ collection: 'transactions', id, depth: 2, user, overrideAccess: false })) as Transaction
  } catch {
    notFound()
  }
}

export async function TxDetail({ id }: { id: string }) {
  const { payload, user, timeZone: tz, currency } = await requireSession()
  const tx = await loadTransaction(payload, user, id)
  const { childrenOf: _, ...lists } = await loadLookups(payload, user)
  const cat = rel(tx.category)
  const acc = rel(tx.account)
  const to = rel(tx.toAccount)
  const person = rel(tx.person)
  const tags = (tx.tags ?? []).map(rel).filter((x): x is Rel => !!x)
  const files = (tx.attachments ?? []).filter((m): m is Media => typeof m === 'object' && !!m)
  const links = [
    ...((tx.outgoingLinks?.docs ?? []) as TransactionLink[]).filter((l) => typeof l === 'object').map((l) => ({ l, other: l.to })),
    ...((tx.incomingLinks?.docs ?? []) as TransactionLink[]).filter((l) => typeof l === 'object').map((l) => ({ l, other: l.from })),
  ]

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )

  return (
    <TxEditToggle
      values={{
        id: String(tx.id),
        type: tx.type,
        title: tx.title,
        note: tx.note ?? '',
        amount: String(Number(tx.amount)),
        date: localInputValue(tx.date, tz),
        category: idOf(tx.category),
        account: idOf(tx.account),
        person: idOf(tx.person),
        tags: (tx.tags ?? []).map(idOf).filter((x): x is string => !!x),
      }}
      lists={lists}
    >
      <div className="flex items-center gap-3">
        <EntityIcon icon={cat?.icon} color={cat?.color} bgColor={cat?.bgColor} size={48} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{tx.title}</h2>
          <p className="text-sm text-muted-foreground">{formatLocalDateTime(tx.date, tz)}</p>
        </div>
      </div>
      <p className={cn('text-3xl font-bold tabular-nums', amountClass(tx.type))}>{formatSigned(Number(tx.amount), tx.type, currency)}</p>

      <div className="divide-y rounded-2xl border bg-background/40 px-4">
        {row('Type', <span className="capitalize">{tx.type}</span>)}
        {cat && row('Category', cat.name)}
        {row('Account', to ? `${acc?.name ?? '?'} → ${to.name}` : (acc?.name ?? '—'))}
        {person && row('Person', <Link href={`/app/people/${person.id}`} className="text-primary hover:underline">{person.name}</Link>)}
        {tags.length > 0 && row('Tags', <span className="flex flex-wrap justify-end gap-1">{tags.map((g) => <span key={g.id} className="rounded-full px-2 py-0.5 text-xs" style={{ background: g.bgColor || 'var(--muted)', color: g.color || 'inherit' }}>{g.name}</span>)}</span>)}
        {tx.source && row('Source', <span className="capitalize">{tx.source}</span>)}
      </div>

      {(tx.shares?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Split with</h3>
          <ul className="divide-y rounded-2xl border px-4">
            {tx.shares!.map((s) => {
              const p = rel(s.person)
              return (
                <li key={s.id ?? p?.id} className="flex justify-between py-2.5 text-sm">
                  <span>{p?.name ?? '?'}</span>
                  <span className="tabular-nums">{formatMoney(Number(s.amount), currency)}</span>
                </li>
              )
            })}
            {tx.myShare != null && (
              <li className="flex justify-between py-2.5 text-sm text-muted-foreground">
                <span>Your share</span>
                <span className="tabular-nums">{formatMoney(Number(tx.myShare), currency)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Linked</h3>
          <ul className="grid gap-2">
            {links.map(({ l, other }) => {
              const o = typeof other === 'object' ? (other as Transaction) : null
              return (
                <li key={l.id}>
                  <Link href={`/app/transactions/${idOf(other)}`} className="flex justify-between rounded-xl border px-3 py-2 text-sm hover:bg-accent">
                    <span>{LINK_LABEL[l.type]}: {o?.title ?? 'transaction'}</span>
                    {o && <span className="tabular-nums text-muted-foreground">{formatMoney(Number(o.amount), currency)}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Attachments</h3>
          <div className="flex flex-wrap gap-2">
            {files.map((m) => (
              <a key={m.id} href={m.url ?? '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
                {m.mimeType?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailURL || m.url || ''} alt={m.filename ?? ''} className="size-24 object-cover" />
                ) : (
                  <span className="block max-w-40 truncate p-3 text-xs">{m.filename}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {tx.note && <p className="rounded-2xl border bg-background/40 p-4 text-sm whitespace-pre-wrap">{tx.note}</p>}
    </TxEditToggle>
  )
}
