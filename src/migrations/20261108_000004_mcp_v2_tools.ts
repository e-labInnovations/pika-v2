import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Permission columns on MCP API keys for the v2 task tools (plugins/mcp-tools.ts), plus
 * ones earlier config changes added without a migration (get_current_user,
 * transaction-links). Tools default to on, so existing keys get them. Idempotent.
 */
const TOOLS = [
  'get_context',
  'add_transactions',
  'update_transactions',
  'delete_transactions',
  'search_transactions',
  'get_overview',
  'get_balances',
  'sms_queue',
  'split_transaction',
  'get_current_user',
]
const LINK_OPS = ['find', 'create', 'update', 'delete']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of TOOLS) {
    await db.execute(sql.raw(`ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_${t}" boolean DEFAULT true`))
  }
  for (const op of LINK_OPS) {
    await db.execute(sql.raw(`ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "transaction_links_${op}" boolean DEFAULT false`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of TOOLS.filter((x) => x !== 'get_current_user')) {
    await db.execute(sql.raw(`ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_${t}"`))
  }
}
