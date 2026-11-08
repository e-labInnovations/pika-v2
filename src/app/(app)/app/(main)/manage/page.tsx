import Link from 'next/link'
import React from 'react'

import { EntityList, type EntityRow } from '@/components/web/EntityList'
import { requireSession } from '@/lib/session'
import type { EntityKind } from '@/lib/web/entities'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Manage' }

const TABS: { key: EntityKind; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'tags', label: 'Tags' },
  { key: 'people', label: 'People' },
  { key: 'accounts', label: 'Accounts' },
]

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { payload, user } = await requireSession()
  const sp = await searchParams
  const tab: EntityKind = TABS.some((t) => t.key === sp.tab) ? (sp.tab as EntityKind) : 'categories'

  // Own records, plus shared system categories/tags (read-only).
  const system = await payload.find({ collection: 'users', where: { role: { equals: 'system' } }, depth: 0, limit: 20, select: { email: true }, overrideAccess: true })
  const owners = [user.id, ...(tab === 'categories' || tab === 'tags' ? system.docs.map((u) => u.id) : [])]
  const res = await payload.find({ collection: tab, where: { user: { in: owners } }, pagination: false, depth: 1, sort: 'name', user, overrideAccess: false })

  const rows: EntityRow[] = res.docs.map((d) => {
    const x = d as unknown as Record<string, unknown>
    const avatar = x.avatar && typeof x.avatar === 'object' ? ((x.avatar as { thumbnailURL?: string; url?: string }).thumbnailURL || (x.avatar as { url?: string }).url || null) : null
    return {
      id: String(x.id),
      name: String(x.name ?? ''),
      archived: x.isActive === false,
      shared: idOf(x.user) !== String(user.id),
      icon: (x.icon as string) ?? null,
      color: (x.color as string) ?? null,
      bgColor: (x.bgColor as string) ?? null,
      description: (x.description as string) ?? '',
      type: (x.type as string) ?? null,
      parentId: idOf(x.parent),
      email: (x.email as string) ?? '',
      phone: (x.phone as string) ?? '',
      smsIdentifiers: (x.smsIdentifiers as string) ?? '',
      avatarUrl: avatar,
    }
  })

  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Manage</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/manage?tab=${t.key}`}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', t.key === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <EntityList kind={tab} rows={rows} />
    </div>
  )
}
