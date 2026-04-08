import type { PayloadHandler } from 'payload'
import { createHmac } from 'crypto'

/**
 * POST /api/oauth/register
 *
 * Dynamic Client Registration (RFC 7591).
 * The MCP SDK requires this endpoint — it self-registers on first connect.
 *
 * We use a stateless approach: the client_id IS the registration data, encoded
 * as a base64url payload + HMAC-SHA256 signature (keyed with PAYLOAD_SECRET).
 * No database record is needed. On authorization, we verify the signature and
 * extract the allowed redirect_uris directly from the client_id.
 */
export const registerHandler: PayloadHandler = async (req) => {
  let body: Record<string, unknown>
  try {
    body = await req.json!()
  } catch {
    return Response.json(
      { error: 'invalid_client_metadata', error_description: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const redirect_uris = body.redirect_uris as string[] | undefined
  const client_name = (body.client_name as string | undefined) || 'MCP Client'

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    return Response.json(
      { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' },
      { status: 400 },
    )
  }

  // Encode registration into a signed client_id — no DB required
  const registration = {
    redirect_uris,
    client_name,
    iat: Math.floor(Date.now() / 1000),
  }
  const clientId = signClientId(registration)

  return Response.json(
    {
      client_id: clientId,
      client_name,
      redirect_uris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: registration.iat,
    },
    { status: 201 },
  )
}

/** Encode + sign registration data into a self-contained client_id. */
export function signClientId(registration: {
  redirect_uris: string[]
  client_name: string
  iat: number
}): string {
  const payload = Buffer.from(JSON.stringify(registration)).toString('base64url')
  const sig = hmac(payload)
  return `${payload}.${sig}`
}

/** Verify and decode a dynamically registered client_id. Returns null if invalid. */
export function decodeClientId(
  clientId: string,
): { redirect_uris: string[]; client_name: string } | null {
  const dotIdx = clientId.lastIndexOf('.')
  if (dotIdx === -1) return null

  const payload = clientId.slice(0, dotIdx)
  const sig = clientId.slice(dotIdx + 1)

  if (hmac(payload) !== sig) return null

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
}

function hmac(data: string): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is not set')
  return createHmac('sha256', secret).update(data).digest('base64url')
}
