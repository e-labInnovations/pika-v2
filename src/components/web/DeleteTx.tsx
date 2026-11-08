'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { deleteTransactionAction } from '@/app/(app)/app/actions'

/** Two-step delete: the first click asks, the second moves it to the trash. */
export function DeleteTx({ id }: { id: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium text-destructive hover:bg-destructive/10">
        <Trash2 className="size-4" /> Delete
      </button>
    )
  }
  return (
    <div className="grid gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
      <p className="text-sm">Delete this transaction? It goes to the trash and can be restored from the admin panel.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const res = await deleteTransactionAction(id)
              if ('error' in res) {
                setError(res.error)
                setBusy(false)
                return
              }
              // The transaction is gone: always land on the list.
              router.push('/app/transactions')
              router.refresh()
            } catch {
              setError('Could not reach the server. Try again.')
              setBusy(false)
            }
          }}
          className="h-9 flex-1 rounded-lg bg-destructive text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-lg border px-3 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
