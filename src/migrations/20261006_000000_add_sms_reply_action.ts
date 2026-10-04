import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// user_settings.sms_reply_action: what replying to an SMS notification does. Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_user_settings_sms_reply_action" AS ENUM('add', 'review');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sms_reply_action" "enum_user_settings_sms_reply_action" DEFAULT 'add';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "sms_reply_action";
    DROP TYPE IF EXISTS "public"."enum_user_settings_sms_reply_action";
  `)
}
