import type { PayloadHandler } from 'payload'

/**
 * POST /api/oauth/token
 *
 * Exchanges an authorization code for an access token.
 * - Verifies PKCE (S256)
 * - Deletes the code immediately (one-time use)
 * - Returns the payload-mcp-api-keys apiKey value as the Bearer access_token
 */
export const tokenHandler: PayloadHandler = async (req) => {
  // Token requests are application/x-www-form-urlencoded
  let params: URLSearchParams
  try {
    const body = await req.text!()
    params = new URLSearchParams(body)
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const grantType = params.get('grant_type')
  const code = params.get('code')
  const clientId = params.get('client_id')
  const codeVerifier = params.get('code_verifier')

  if (grantType !== 'authorization_code') {
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 })
  }

  if (!code || !clientId) {
    return Response.json(
      { error: 'invalid_request', error_description: 'code and client_id are required' },
      { status: 400 },
    )
  }

  const { payload } = req

  const results = await payload.find({
    collection: 'oauth-codes',
    where: {
      and: [{ code: { equals: code } }, { clientId: { equals: clientId } }],
    },
    overrideAccess: true,
    limit: 1,
  })

  const authCode = results.docs[0]
  if (!authCode) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 })
  }

  // Delete immediately — one-time use (do this before other checks to prevent replay attacks)
  await payload.delete({ collection: 'oauth-codes', id: authCode.id as string, overrideAccess: true })

  if (new Date(authCode.expiresAt as string) < new Date()) {
    return Response.json(
      { error: 'invalid_grant', error_description: 'Authorization code has expired' },
      { status: 400 },
    )
  }

  // Verify PKCE S256: SHA256(code_verifier) base64url-encoded must equal stored code_challenge
  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      return Response.json(
        { error: 'invalid_grant', error_description: 'code_verifier is required' },
        { status: 400 },
      )
    }
    const { createHash } = await import('crypto')
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url')
    if (challenge !== authCode.codeChallenge) {
      return Response.json(
        { error: 'invalid_grant', error_description: 'PKCE verification failed' },
        { status: 400 },
      )
    }
  }

  // The apiKeyValue IS the access_token — the MCP plugin's default Bearer auth will find it
  return new Response(
    JSON.stringify({
      access_token: authCode.apiKeyValue,
      token_type: 'Bearer',
      scope: 'mcp',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  )
}
