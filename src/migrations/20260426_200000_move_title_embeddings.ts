import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "transaction_embeddings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "transaction_id" uuid NOT NULL,
      "user_id" uuid NOT NULL,
      "type" varchar NOT NULL,
      "title_embedding" jsonb,
      "title_embedding_model" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "transaction_embeddings_transaction_id_unique" UNIQUE ("transaction_id")
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transaction_embeddings"
        ADD CONSTRAINT "transaction_embeddings_transaction_id_transactions_id_fk"
        FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transaction_embeddings"
        ADD CONSTRAINT "transaction_embeddings_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transaction_embeddings_transaction_idx" ON "transaction_embeddings" USING btree ("transaction_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transaction_embeddings_user_idx"        ON "transaction_embeddings" USING btree ("user_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transaction_embeddings_model_idx"       ON "transaction_embeddings" USING btree ("title_embedding_model");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transaction_embeddings_created_at_idx"  ON "transaction_embeddings" USING btree ("created_at");`)

  // Migrate existing embedding data out of transactions (skip rows already copied).
  await db.execute(sql`
    INSERT INTO "transaction_embeddings"
      ("transaction_id", "user_id", "type", "title_embedding", "title_embedding_model", "updated_at", "created_at")
    SELECT
      t."id",
      t."user_id",
      t."type"::text,
      t."title_embedding",
      t."title_embedding_model",
      now(),
      now()
    FROM "transactions" t
    WHERE t."title_embedding" IS NOT NULL
      AND t."user_id" IS NOT NULL
    ON CONFLICT ("transaction_id") DO NOTHING;
  `)

  await db.execute(sql`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "title_embedding";`)
  await db.execute(sql`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "title_embedding_model";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "title_embedding" jsonb;`)
  await db.execute(sql`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "title_embedding_model" varchar;`)

  await db.execute(sql`
    UPDATE "transactions" t
    SET
      "title_embedding"       = e."title_embedding",
      "title_embedding_model" = e."title_embedding_model"
    FROM "transaction_embeddings" e
    WHERE e."transaction_id" = t."id";
  `)

  await db.execute(sql`DROP TABLE IF EXISTS "transaction_embeddings";`)
}
