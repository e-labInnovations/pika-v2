'use client'

import { Pencil } from 'lucide-react'
import React from 'react'

import type { LookupItem } from '@/lib/web/transactions'
import { EditTxForm, type EditValues } from './EditTxForm'

/** Read view (server-rendered children) with an Edit button that swaps in the form. */
export function TxEditToggle({
  values,
  lists,
  children,
}: {
  values: EditValues
  lists: { categories: LookupItem[]; tags: LookupItem[]; people: LookupItem[]; accounts: LookupItem[] }
  children: React.ReactNode
}) {
  const [editing, setEditing] = React.useState(false)
  const done = React.useCallback(() => setEditing(false), [])
  if (editing) return <EditTxForm values={values} lists={lists} onDone={done} />
  return (
    <div className="grid grid-cols-1 gap-5">
      {children}
      <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium hover:bg-accent">
        <Pencil className="size-4" /> Edit
      </button>
    </div>
  )
}
