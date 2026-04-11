import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle CORS preflight for all MCP-related paths
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  // RFC 8707 path-based discovery: some MCP clients (mcp-remote, Claude Desktop)
  // try GET {resource}/.well-known/oauth-protected-resource in addition to the
  // standard /.well-known/ path. Rewrite to our canonical well-known route.
  if (pathname === '/api/mcp/.well-known/oauth-protected-resource') {
    return NextResponse.rewrite(
      new URL('/.well-known/oauth-protected-resource', request.url),
    )
  }

  if (pathname.startsWith('/api/mcp') || pathname.startsWith('/api/oauth')) {
    const response = NextResponse.next()
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))

    if (pathname.startsWith('/api/mcp')) {
      const base = process.env.NEXT_PUBLIC_SERVER_URL ?? `${request.nextUrl.protocol}//${request.headers.get('host')}`
      response.headers.set(
        'WWW-Authenticate',
        `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      )
    }

    return response
  }

  // Add CORS headers to well-known discovery endpoints so browser-based
  // OAuth clients (e.g. MCP inspector) can fetch them cross-origin.
  if (pathname.startsWith('/.well-known/')) {
    const response = NextResponse.next()
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/mcp',
    '/api/mcp/:path*',
    '/api/oauth/:path*',
    '/.well-known/:path*',
  ],
}
