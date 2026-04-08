import type { PayloadHandler } from 'payload'
import { validateClient } from '../config'

/** Treats localhost and 127.0.0.1 as equivalent for local development. */
function normalizeLocalhost(uri: string): string {
  return uri.replace('://127.0.0.1:', '://localhost:')
}

/**
 * GET /api/oauth/authorize
 *
 * Validates the OAuth authorization request (client, PKCE, resource) and
 * redirects the user to the consent page.
 */
export const authorizeGetHandler: PayloadHandler = async (req) => {
  if (!req.url) {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }
  const url = new URL(req.url)
  const clientId = url.searchParams.get('client_id')
  const redirectUri = url.searchParams.get('redirect_uri')
  const state = url.searchParams.get('state')
  const codeChallenge = url.searchParams.get('code_challenge')
  const challengeMethod = url.searchParams.get('code_challenge_method')
  const resource = url.searchParams.get('resource') // RFC 8707

  // PKCE S256 is mandatory per MCP spec — clients that don't send it must be rejected
  if (!codeChallenge || challengeMethod !== 'S256') {
    return Response.json(
      { error: 'invalid_request', error_description: 'PKCE with code_challenge_method=S256 is required' },
      { status: 400 },
    )
  }

  const client = validateClient(clientId ?? '', redirectUri ?? '')
  if (!client) {
    return Response.json(
      { error: 'invalid_client', error_description: 'Unknown client_id or redirect_uri not allowed' },
      { status: 400 },
    )
  }

  // Validate resource parameter per RFC 8707 (if provided).
  // Use NEXT_PUBLIC_SERVER_URL as the canonical public origin — req.url contains
  // the internal address (localhost:3333) when behind a reverse proxy, so we
  // cannot derive the public hostname from it.
  if (resource) {
    const publicBase = process.env.NEXT_PUBLIC_SERVER_URL ?? `${url.protocol}//${url.host}`
    const expectedResource = normalizeLocalhost(`${publicBase}/api/mcp`)
    if (normalizeLocalhost(resource) !== expectedResource) {
      return Response.json(
        { error: 'invalid_target', error_description: `Unknown resource. Expected: ${expectedResource}` },
        { status: 400 },
      )
    }
  }

  // Build the consent URL using the public server origin.
  const consentUrl = new URL('/oauth/consent', process.env.NEXT_PUBLIC_SERVER_URL ?? `${url.protocol}//${url.host}`)
  consentUrl.searchParams.set('client_id', clientId!)
  consentUrl.searchParams.set('redirect_uri', redirectUri!)
  consentUrl.searchParams.set('client_name', client.name)
  consentUrl.searchParams.set('code_challenge', codeChallenge)
  if (state) consentUrl.searchParams.set('state', state)

  return Response.redirect(consentUrl.toString(), 302)
}
