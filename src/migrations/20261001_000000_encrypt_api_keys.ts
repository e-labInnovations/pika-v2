import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { decryptSecret, encryptSecret, isEncrypted } from '../utilities/secretBox'

// Encrypts the AI API keys already stored in plaintext (see utilities/secretBox).
// Safe to re-run: values that are already encrypted are skipped.
const COLUMNS = [
  { table: 'user_settings', column: 'gemini_api_key' },
  { table: 'user_settings', column: 'hf_api_key' },
  { table: 'app_settings', column: 'ai_gemini_api_key' },
  { table: 'app_settings', column: 'ai_hf_api_key' },
] as const

async function rewrite(db: MigrateUpArgs['db'], transform: (v: string) => string, wantEncrypted: boolean) {
  for (const { table, column } of COLUMNS) {
    const { rows } = await db.execute(
      sql`SELECT id, ${sql.identifier(column)} AS v FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} <> ''`,
    )
    for (const row of rows as { id: string | number; v: string }[]) {
      if (isEncrypted(row.v) === wantEncrypted) continue
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${transform(row.v)} WHERE id = ${row.id}`,
      )
    }
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await rewrite(db, encryptSecret, true)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await rewrite(db, decryptSecret, false)
}
