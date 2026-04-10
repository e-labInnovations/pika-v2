import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MCP_SCOPES } from '../../../plugins/mcp'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? new URL(process.env.NEXT_PUBLIC_SERVER_URL!).host
  const proto = request.headers.get('x-forwarded-proto') ?? (request.nextUrl.protocol.replace(':', '') || 'http')
  const base = `${proto}://${host}`

  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: MCP_SCOPES,
      token_endpoint_auth_methods_supported: ['none'],
      registration_endpoint: `${base}/api/oauth/register`,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
