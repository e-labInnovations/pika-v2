import { decodeClientId } from './endpoints/register'

export interface OAuthClient {
  name: string
  redirectUris: string[]
}

/**
 * Pre-registered OAuth clients (optional — dynamic registration is preferred).
 * Add entries here if you want to hard-code known clients.
 */
export const KNOWN_CLIENTS: Record<string, OAuthClient> = {}

/**
 * Validates a client_id + redirect_uri pair.
 * Handles both pre-registered and dynamically registered clients.
 */
export function validateClient(
  clientId: string,
  redirectUri: string,
): OAuthClient | null {
  // 1. Check pre-registered clients
  const known = KNOWN_CLIENTS[clientId]
  if (known) {
    if (known.redirectUris.includes(redirectUri) || isLocalhostUri(redirectUri)) {
      return known
    }
    return null
  }

  // 2. Try to decode as a dynamically registered client_id
  const dynamic = decodeClientId(clientId)
  if (!dynamic) return null

  if (!dynamic.redirect_uris.includes(redirectUri)) return null

  return { name: dynamic.client_name, redirectUris: dynamic.redirect_uris }
}

export function isLocalhostUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
}
