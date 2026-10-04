import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// user_settings.ai_narrow_prompt: list only likely entities in text-to-transaction prompts. Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ai_narrow_prompt" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "ai_narrow_prompt";`)
}
