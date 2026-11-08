import React from 'react'

import { Panel } from '@/components/web/Panel'
import { TxDetail } from '@/components/web/TxDetail'

/** Opened from the list: the transaction as a side panel over it. */
export default async function TransactionPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Panel>
      <TxDetail id={id} />
    </Panel>
  )
}
