import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Auto-confirm for trusted merchants: two user settings and two flags on captured SMS.
// Same DDL as Payload's schema push. Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sms_auto_confirm" boolean DEFAULT false;
    ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sms_auto_confirm_max_amount" numeric DEFAULT 2000;
    ALTER TABLE "captured_sms" ADD COLUMN IF NOT EXISTS "auto_confirmed" boolean DEFAULT false;
    ALTER TABLE "captured_sms" ADD COLUMN IF NOT EXISTS "auto_undone" boolean DEFAULT false;
    CREATE INDEX IF NOT EXISTS "captured_sms_auto_confirmed_idx" ON "captured_sms" USING btree ("auto_confirmed");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "captured_sms_auto_confirmed_idx";
    ALTER TABLE "captured_sms" DROP COLUMN IF EXISTS "auto_undone";
    ALTER TABLE "captured_sms" DROP COLUMN IF EXISTS "auto_confirmed";
    ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "sms_auto_confirm_max_amount";
    ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "sms_auto_confirm";
  `)
}
