import type { PayloadHandler } from 'payload'
import { validateClient } from '../config'

/**
 * POST /api/oauth/authorize
 *
 * Called by the consent page when the user clicks "Allow".
 * - Verifies the user is authenticated (req.user from payload-token cookie)
 * - Re-validates the client (never trust browser params alone)
 * - Creates a payload-mcp-api-keys record with selected permissions
 * - Issues a short-lived auth code linked to that API key
 * - Returns { redirectTo: "<redirect_uri>?code=...&state=..." }
 */
export const authorizePostHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json!()
  } catch {
    return Response.json(
      { error: 'invalid_request', error_description: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { clientId, redirectUri, state, codeChallenge, permissions, label } = body as {
    clientId?: string
    redirectUri?: string
    state?: string
    codeChallenge?: string
    permissions?: Record<string, unknown>
    label?: string
  }

  if (!clientId || !redirectUri || !codeChallenge || !permissions) {
    return Response.json(
      { error: 'invalid_request', error_description: 'Missing required fields' },
      { status: 400 },
    )
  }

  // Re-validate client — never trust params that came from the browser
  const client = validateClient(clientId, redirectUri)
  if (!client) {
    return Response.json(
      { error: 'invalid_client', error_description: 'Unknown client or redirect_uri not allowed' },
      { status: 400 },
    )
  }

  const { payload } = req

  // Generate the API key ourselves — Payload does NOT auto-generate it.
  // Payload encrypts the key at rest (beforeChange hook) and looks up auth
  // requests via apiKeyIndex = HMAC-SHA256(PAYLOAD_SECRET, plaintext_key).
  // Since we generate it, we know it upfront and don't need to read it back.
  const { randomBytes } = await import('crypto')
  const apiKeyValue = randomBytes(20).toString('hex')

  const apiKeyRecord = await payload.create({
    collection: 'payload-mcp-api-keys',
    data: {
      label: (label as string) || client.name,
      user: req.user.id,
      enableAPIKey: true,
      apiKey: apiKeyValue,
      ...permissions,
    },
    overrideAccess: true,
  })

  // Issue a short-lived auth code (10 min TTL)
  const code = randomBytes(32).toString('hex')

  await payload.create({
    collection: 'oauth-codes',
    data: {
      code,
      clientId,
      apiKeyId: String(apiKeyRecord.id),
      apiKeyValue,
      redirectUri,
      codeChallenge,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      userId: String(req.user.id),
    },
    overrideAccess: true,
  })

  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) callbackUrl.searchParams.set('state', String(state))

  return Response.json({ redirectTo: callbackUrl.toString() })
}
