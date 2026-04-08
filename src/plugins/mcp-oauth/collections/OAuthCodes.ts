import { User } from '@/payload-types'
import type { CollectionConfig } from 'payload'

export const OAuthCodes: CollectionConfig = {
  slug: 'oauth-codes',
  admin: { hidden: true },
  access: {
    // Only readable by admins (for debugging). Created/deleted programmatically only.
    read: ({ req }) => (req.user as User)?.role === 'admin',
    create: () => false,
    update: () => false,
    delete: ({ req }) => (req.user as User)?.role === 'admin',
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'clientId', type: 'text', required: true },
    // ID of the record in payload-mcp-api-keys
    { name: 'apiKeyId', type: 'text', required: true },
    // The raw apiKey value — this becomes the OAuth access_token
    { name: 'apiKeyValue', type: 'text', required: true },
    { name: 'redirectUri', type: 'text', required: true },
    // PKCE S256 code_challenge (null if client didn't use PKCE, but we require it)
    { name: 'codeChallenge', type: 'text' },
    // TTL: 10 minutes from issuance
    { name: 'expiresAt', type: 'date', required: true },
    // For audit trail
    { name: 'userId', type: 'text', required: true },
  ],
}
