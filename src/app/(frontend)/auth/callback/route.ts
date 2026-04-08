import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getExpFromJwt(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const isMobile = cookieStore.has('mobile_oauth')
  const token = cookieStore.get('payload-token')?.value

  // If there's a pending MCP OAuth consent flow, redirect back to the consent page.
  // Route Handlers can delete cookies (Server Components cannot).
  const pendingOAuth = cookieStore.get('pending_oauth_params')?.value
  if (!isMobile && pendingOAuth && token) {
    cookieStore.delete('pending_oauth_params')
    return NextResponse.redirect(new URL(`/oauth/consent?${pendingOAuth}`, request.url))
  }

  if (!isMobile) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login?error=oauth_failed', request.url))
  }

  const exp = getExpFromJwt(token)
  const params = new URLSearchParams({ token })
  if (exp) params.set('exp', String(exp))
  return NextResponse.redirect(`pika://auth?${params}`)
}
