import { MCP_SCOPES } from '../../../plugins/mcp-constants'

const BASE = process.env.NEXT_PUBLIC_SERVER_URL!

export function GET() {
  return Response.json(
    {
      resource: `${BASE}/api/mcp`,
      authorization_servers: [BASE],
      scopes_supported: MCP_SCOPES,
      bearer_methods_supported: ['header'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
