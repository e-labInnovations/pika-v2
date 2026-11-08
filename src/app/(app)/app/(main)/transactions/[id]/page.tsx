import Link from 'next/link'
import React from 'react'

import { TxDetail } from '@/components/web/TxDetail'

export const metadata = { title: 'Transaction' }

/** Opened directly (link, reload): the transaction as a page. */
export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Link href="/app/transactions" className="text-sm text-primary hover:underline">← Transactions</Link>
      <div className="rounded-2xl border bg-card p-6">
        <TxDetail id={id} />
      </div>
    </div>
  )
}
