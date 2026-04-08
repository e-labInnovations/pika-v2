import { createHmac } from 'crypto'
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

function makeExchangeCode(token: string, exp: number | null): string {
  const data = JSON.stringify({ token, exp, iat: Math.floor(Date.now() / 1000) })
  const payload = Buffer.from(data).toString('base64url')
  const sig = createHmac('sha256', process.env.PAYLOAD_SECRET!).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  // --- Generic client auth flow (mobile, desktop, CLI, etc.) ---
  // Initiated by /api/auth/client-init?callback=<uri>
  const clientCallback = cookieStore.get('client_auth')?.value
  if (clientCallback) {
    cookieStore.delete('client_auth')
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login?error=oauth_failed', request.url))
    }
    const exp = getExpFromJwt(token)
    const code = makeExchangeCode(token, exp)
    const callbackUrl = new URL(clientCallback)
    callbackUrl.searchParams.set('code', code)
    return NextResponse.redirect(callbackUrl.toString())
  }

  // --- MCP OAuth consent flow ---
  const pendingOAuth = cookieStore.get('pending_oauth_params')?.value
  if (pendingOAuth && token) {
    cookieStore.delete('pending_oauth_params')
    return NextResponse.redirect(new URL(`/oauth/consent?${pendingOAuth}`, request.url))
  }

  // --- Default: browser login → admin panel ---
  return NextResponse.redirect(new URL('/admin', request.url))
}
