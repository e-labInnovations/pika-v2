import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// SMS capture: the `captured-sms` collection, transactions.source/external_ref and
// accounts.sms_identifiers. DDL copied from what Payload's schema push creates, so
// the two cannot drift. Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_captured_sms_status" AS ENUM('pending', 'confirmed', 'dismissed', 'duplicate', 'unparsed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_transactions_source" AS ENUM('manual', 'sms', 'ai', 'import');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "captured_sms" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "sender" varchar NOT NULL,
      "body" varchar NOT NULL,
      "received_at" timestamp(3) with time zone NOT NULL,
      "hash" varchar NOT NULL,
      "status" "enum_captured_sms_status" DEFAULT 'pending' NOT NULL,
      "parsed" jsonb,
      "merchant_key" varchar,
      "suggestion" jsonb,
      "account_id" uuid,
      "transaction_id" uuid,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "source" "enum_transactions_source";
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "external_ref" varchar;
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "sms_identifiers" varchar;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "captured_sms_id" uuid;
  `)

  for (const [name, ddl] of [
    ['captured_sms_user_id_users_id_fk', sql`ALTER TABLE "captured_sms" ADD CONSTRAINT "captured_sms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`],
    ['captured_sms_account_id_accounts_id_fk', sql`ALTER TABLE "captured_sms" ADD CONSTRAINT "captured_sms_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action`],
    ['captured_sms_transaction_id_transactions_id_fk', sql`ALTER TABLE "captured_sms" ADD CONSTRAINT "captured_sms_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action`],
    ['payload_locked_documents_rels_captured_sms_fk', sql`ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_captured_sms_fk" FOREIGN KEY ("captured_sms_id") REFERENCES "public"."captured_sms"("id") ON DELETE cascade ON UPDATE no action`],
  ] as const) {
    const exists = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`)
    if (exists.rows.length === 0) await db.execute(ddl)
  }

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "captured_sms_user_idx" ON "captured_sms" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "captured_sms_received_at_idx" ON "captured_sms" USING btree ("received_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "captured_sms_hash_idx" ON "captured_sms" USING btree ("hash");
    CREATE INDEX IF NOT EXISTS "captured_sms_status_idx" ON "captured_sms" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "captured_sms_merchant_key_idx" ON "captured_sms" USING btree ("merchant_key");
    CREATE INDEX IF NOT EXISTS "captured_sms_account_idx" ON "captured_sms" USING btree ("account_id");
    CREATE INDEX IF NOT EXISTS "captured_sms_transaction_idx" ON "captured_sms" USING btree ("transaction_id");
    CREATE INDEX IF NOT EXISTS "captured_sms_updated_at_idx" ON "captured_sms" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "captured_sms_created_at_idx" ON "captured_sms" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_captured_sms_id_idx" ON "payload_locked_documents_rels" USING btree ("captured_sms_id");
    CREATE INDEX IF NOT EXISTS "transactions_external_ref_idx" ON "transactions" USING btree ("external_ref");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_captured_sms_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_captured_sms_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "captured_sms_id";
    DROP TABLE IF EXISTS "captured_sms" CASCADE;
    DROP INDEX IF EXISTS "transactions_external_ref_idx";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "source";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "external_ref";
    ALTER TABLE "accounts" DROP COLUMN IF EXISTS "sms_identifiers";
    DROP TYPE IF EXISTS "public"."enum_captured_sms_status";
    DROP TYPE IF EXISTS "public"."enum_transactions_source";
  `)
}
