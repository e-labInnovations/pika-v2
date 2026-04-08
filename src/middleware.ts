import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/mcp')) {
    // Handle CORS preflight — Payload's catch-all doesn't export an OPTIONS handler
    // so Next.js returns 500 without this intercept.
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Use the Host header (not nextUrl.origin — Next.js normalizes that to localhost).
    // The Host header preserves whatever hostname the client actually connected with,
    // so the resource_metadata URL will match what the MCP SDK used.
    const host = request.headers.get('host') ?? request.nextUrl.host
    const proto = request.nextUrl.protocol // 'http:' or 'https:'
    const origin = `${proto}//${host}`
    const response = NextResponse.next()
    response.headers.set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    )
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/mcp', '/api/mcp/:path*'],
}
