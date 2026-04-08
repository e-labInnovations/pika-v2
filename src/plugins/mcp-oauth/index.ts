import type { Config, Plugin } from 'payload'
import { OAuthCodes } from './collections/OAuthCodes'
import { authorizeGetHandler } from './endpoints/authorize.get'
import { authorizePostHandler } from './endpoints/authorize.post'
import { tokenHandler } from './endpoints/token'
import { registerHandler } from './endpoints/register'

/**
 * MCP OAuth Plugin
 *
 * Adds OAuth 2.0 Authorization Code flow with PKCE to the Payload MCP plugin.
 * MCP clients can connect via a consent screen instead of manually copying API keys.
 *
 * The OAuth access_token issued is the payload-mcp-api-keys.apiKey value, so the
 * MCP plugin's existing Bearer token auth works with no additional configuration.
 *
 * Required Next.js additions (outside this plugin — cannot be added via Payload plugins):
 *   - middleware.ts at project root (WWW-Authenticate header)
 *   - src/app/.well-known/oauth-protected-resource/route.ts
 *   - src/app/.well-known/oauth-authorization-server/route.ts
 *   - src/app/(frontend)/oauth/consent/page.tsx + ConsentForm.tsx
 *   - src/app/(frontend)/oauth/login/route.ts (unauthenticated redirect handler)
 *   - Modify src/app/(frontend)/auth/callback/page.tsx (pending OAuth redirect)
 */
export const mcpOAuthPlugin = (): Plugin =>
  (incomingConfig: Config): Config => ({
    ...incomingConfig,
    collections: [...(incomingConfig.collections ?? []), OAuthCodes],
    endpoints: [
      ...(incomingConfig.endpoints ?? []),
      { path: '/oauth/authorize', method: 'get', handler: authorizeGetHandler },
      { path: '/oauth/authorize', method: 'post', handler: authorizePostHandler },
      { path: '/oauth/token', method: 'post', handler: tokenHandler },
      { path: '/oauth/register', method: 'post', handler: registerHandler },
    ],
  })
