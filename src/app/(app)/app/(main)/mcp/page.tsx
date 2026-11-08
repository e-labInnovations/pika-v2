import React from 'react'

import { McpKeys } from '@/components/web/McpKeys'
import { requireSession } from '@/lib/session'
import { listMcpKeys } from '@/lib/web/mcpKeys'
import { headers } from 'next/headers'

export const metadata = { title: 'MCP' }

export default async function McpPage() {
  const { payload, user } = await requireSession()
  const keys = await listMcpKeys(payload, user)
  const h = await headers()
  const origin = process.env.NEXT_PUBLIC_SERVER_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
  const server = `${origin}/api/mcp`
  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MCP</h1>
        <p className="text-sm text-muted-foreground">Let AI assistants read and add your Pika transactions.</p>
      </div>
      <McpKeys keys={keys} server={server} />
    </div>
  )
}
