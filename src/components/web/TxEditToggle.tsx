'use client'

import { Pencil } from 'lucide-react'
import React from 'react'

import type { LookupItem } from '@/lib/web/transactions'
import { DeleteTx } from './DeleteTx'
import { SplitParts } from './SplitParts'
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
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium hover:bg-accent">
          <Pencil className="size-4" /> Edit
        </button>
        <DeleteTx id={values.id} />
      </div>
      {values.type !== 'transfer' && values.shares.length === 0 && (
        <SplitParts id={values.id} total={Number(values.amount)} type={values.type} categories={lists.categories} defaultCategory={values.category} />
      )}
    </div>
  )
}
