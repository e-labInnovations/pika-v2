import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_SCHEMES = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//

/**
 * GET /api/auth/client-init?callback=<uri>
 *
 * Initiates Google OAuth for any client app (mobile, desktop, CLI, etc.).
 * After login, /auth/callback reads the `client_auth` cookie and redirects
 * to `callback?code=<one-time-code>`. The client then exchanges the code
 * for a JWT via POST /api/auth/exchange.
 *
 * Security: only custom URI schemes are allowed (not http/https) to prevent
 * open redirect abuse.
 */
export const GET = (req: NextRequest): NextResponse => {
  const callback = req.nextUrl.searchParams.get('callback')

  if (!callback) {
    return NextResponse.json({ error: 'Missing callback parameter' }, { status: 400 })
  }

  // Block http/https callbacks — only custom URI schemes (pika://, myapp://, etc.)
  if (/^https?:\/\//i.test(callback)) {
    return NextResponse.json({ error: 'http/https callbacks not allowed' }, { status: 400 })
  }

  if (!ALLOWED_SCHEMES.test(callback)) {
    return NextResponse.json({ error: 'Invalid callback URI' }, { status: 400 })
  }

  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3333'
  const res = NextResponse.redirect(`${serverURL}/api/auth/oauth/authorization/google`)

  res.cookies.set('client_auth', callback, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes — matches Google OAuth TTL
    path: '/',
  })

  return res
}
