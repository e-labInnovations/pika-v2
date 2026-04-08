import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /oauth/login
 *
 * Stores pending OAuth params in a short-lived cookie, then redirects to
 * Google login. After successful login, /auth/callback reads this cookie
 * and redirects back to /oauth/consent with the preserved params.
 *
 * This is a separate route handler because Next.js server components cannot
 * set cookies — only route handlers and server actions can.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  // Preserve all OAuth params through the login flow
  const oauthParams = searchParams.toString()

  const response = NextResponse.redirect(
    new URL('/api/auth/oauth/authorization/google', origin),
  )

  response.cookies.set('pending_oauth_params', oauthParams, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60, // 10 minutes — matches auth code TTL
    path: '/',
    sameSite: 'lax',
  })

  return response
}
