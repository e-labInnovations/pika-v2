import { MCP_SCOPES } from '../../../plugins/mcp-constants'

const BASE = process.env.NEXT_PUBLIC_SERVER_URL!

export function GET() {
  return Response.json(
    {
      issuer: BASE,
      authorization_endpoint: `${BASE}/api/oauth/authorize`,
      token_endpoint: `${BASE}/api/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: MCP_SCOPES,
      token_endpoint_auth_methods_supported: ['none'],
      registration_endpoint: `${BASE}/api/oauth/register`,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
