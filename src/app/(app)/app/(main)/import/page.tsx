import React from 'react'

import { StatementImport } from '@/components/web/StatementImport'
import { requireSession } from '@/lib/session'
import { loadLookups } from '@/lib/web/transactions'

export const metadata = { title: 'Import statement' }

export default async function ImportPage() {
  const { payload, user, currency } = await requireSession()
  const l = await loadLookups(payload, user)
  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
        <p className="text-sm text-muted-foreground">Upload a Federal Bank account statement (PDF). Pika marks what you already have and fills in the rest for you to check.</p>
      </div>
      <StatementImport
        currency={currency}
        accounts={l.accounts.filter((a) => !a.archived)}
        categories={l.categories.filter((c) => !c.archived)}
      />
    </div>
  )
}
