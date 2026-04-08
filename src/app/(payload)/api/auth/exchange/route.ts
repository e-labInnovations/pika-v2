import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const CODE_TTL_SECONDS = 60

function hmac(payload: string): string {
  return createHmac('sha256', process.env.PAYLOAD_SECRET!).update(payload).digest('base64url')
}

/**
 * POST /api/auth/exchange
 * Body: { code: string }
 *
 * Exchanges a one-time code (issued by /auth/callback) for a JWT.
 * The code is a HMAC-signed, time-bound envelope — no DB lookup needed.
 * Expires after 60 seconds regardless of JWT lifetime.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let code: string
  try {
    const body = await req.json()
    code = body?.code
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const dotIdx = code.lastIndexOf('.')
  if (dotIdx === -1) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const payload = code.slice(0, dotIdx)
  const sig = code.slice(dotIdx + 1)

  // Constant-time signature verification
  try {
    const expected = hmac(payload)
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  let parsed: { token: string; exp: number | null; iat: number }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  // Enforce short TTL on the code itself
  const age = Math.floor(Date.now() / 1000) - parsed.iat
  if (age > CODE_TTL_SECONDS || age < 0) {
    return NextResponse.json({ error: 'Code expired' }, { status: 400 })
  }

  return NextResponse.json({ token: parsed.token, exp: parsed.exp })
}
