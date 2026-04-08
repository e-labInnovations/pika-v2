import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/mobile-init
 *
 * @deprecated Use /api/auth/client-init?callback=pika://auth instead.
 * Kept as an alias for backwards compatibility with existing app versions.
 */
export const GET = (_req: NextRequest): NextResponse => {
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3333'
  const url = new URL('/api/auth/client-init', serverURL)
  url.searchParams.set('callback', 'pika://auth')
  return NextResponse.redirect(url.toString())
}
