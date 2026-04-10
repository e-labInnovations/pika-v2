import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MCP_SCOPES } from '../../../plugins/mcp'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? new URL(process.env.NEXT_PUBLIC_SERVER_URL!).host
  const proto = request.headers.get('x-forwarded-proto') ?? (request.nextUrl.protocol.replace(':', '') || 'http')
  const base = `${proto}://${host}`

  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: MCP_SCOPES,
      bearer_methods_supported: ['header'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
