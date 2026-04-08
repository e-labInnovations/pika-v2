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

  if (pathname.startsWith('/api/mcp') || pathname.startsWith('/api/oauth')) {
    const response = NextResponse.next()
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))

    if (pathname.startsWith('/api/mcp')) {
      // Use the Host header (not nextUrl.origin — Next.js normalizes that to localhost).
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
  matcher: ['/api/mcp', '/api/mcp/:path*', '/api/oauth/:path*', '/.well-known/:path*'],
}
