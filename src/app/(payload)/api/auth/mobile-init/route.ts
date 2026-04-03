import { NextRequest, NextResponse } from 'next/server'

export const GET = (_req: NextRequest): NextResponse => {
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3333'
  const res = NextResponse.redirect(`${serverURL}/api/auth/oauth/authorization/google`)
  res.cookies.set('mobile_oauth', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  })
  return res
}
