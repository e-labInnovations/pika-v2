import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Friends' shares of a shared expense (`transactions.shares`). DDL taken from what
// Payload's schema push creates for the array field, so the two cannot drift.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "transactions_shares" (
      "_order" integer NOT NULL,
      "_parent_id" uuid NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "person_id" uuid,
      "amount" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions_shares" ADD CONSTRAINT "transactions_shares_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions_shares" ADD CONSTRAINT "transactions_shares_person_id_people_id_fk"
        FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "transactions_shares_order_idx" ON "transactions_shares" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "transactions_shares_parent_id_idx" ON "transactions_shares" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "transactions_shares_person_idx" ON "transactions_shares" USING btree ("person_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "transactions_shares" CASCADE;`)
}
