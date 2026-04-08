import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/mcp')) {
    // Use the Host header (not nextUrl.origin — Next.js normalizes that to localhost).
    // The Host header preserves whatever hostname the client actually connected with,
    // so the resource_metadata URL will match what the MCP SDK used.
    const host = request.headers.get('host') ?? request.nextUrl.host
    const proto = request.nextUrl.protocol // 'http:' or 'https:'
    const origin = `${proto}//${host}`
    response.headers.set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    )
  }
  return response
}

export const config = {
  matcher: ['/api/mcp', '/api/mcp/:path*'],
}
