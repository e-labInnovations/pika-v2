import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// budgets: a monthly limit per category (collections/Budgets.ts). Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "budgets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "category_id" uuid NOT NULL,
      "amount" numeric NOT NULL,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "budgets_id" uuid;
    CREATE INDEX IF NOT EXISTS "budgets_user_idx" ON "budgets" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "budgets_category_idx" ON "budgets" USING btree ("category_id");
    CREATE INDEX IF NOT EXISTS "budgets_updated_at_idx" ON "budgets" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "budgets_created_at_idx" ON "budgets" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_budgets_id_idx" ON "payload_locked_documents_rels" USING btree ("budgets_id");
  `)
  for (const [name, ddl] of [
    ['budgets_user_id_users_id_fk', sql`ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`],
    ['budgets_category_id_categories_id_fk', sql`ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action`],
    ['payload_locked_documents_rels_budgets_fk', sql`ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_budgets_fk" FOREIGN KEY ("budgets_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action`],
  ] as const) {
    const exists = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`)
    if (exists.rows.length === 0) await db.execute(ddl)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_budgets_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_budgets_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "budgets_id";
    DROP TABLE IF EXISTS "budgets" CASCADE;
  `)
}
