import { mcp } from './mcp'
import { auth } from './auth'
import { mcpOAuthPlugin } from './mcp-oauth'

export const plugins = [mcp, auth, mcpOAuthPlugin()]
