import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MCP_SCOPES } from '../../../plugins/mcp-constants'

/**
 * GET /.well-known/openid-configuration
 *
 * OpenID Connect Discovery 1.0 endpoint. Some OAuth/OIDC clients (including
 * @modelcontextprotocol/inspector) probe this path in addition to or instead
 * of /.well-known/oauth-authorization-server (RFC 8414).
 *
 * We are not a full OIDC provider — no id_token or userinfo endpoint — but
 * returning the authorization and token endpoints here satisfies clients that
 * use OIDC discovery to bootstrap the OAuth 2.0 flow.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? new URL(process.env.NEXT_PUBLIC_SERVER_URL!).host
  const proto =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '') ??
    'http'
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
      subject_types_supported: ['public'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
