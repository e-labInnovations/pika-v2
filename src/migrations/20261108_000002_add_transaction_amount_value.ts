import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * transactions.amount_value: the amount as a number (amount itself is text), so the
 * server can filter and sort by amount. Filled here for existing rows; a field hook keeps
 * it in step from now on. Idempotent.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "amount_value" numeric;
    CREATE INDEX IF NOT EXISTS "transactions_amount_value_idx" ON "transactions" USING btree ("amount_value");
  `)
  const res = await db.execute(sql`
    UPDATE "transactions" SET "amount_value" = "amount"::numeric
    WHERE "amount" ~ '^\\s*-?[0-9]+(\\.[0-9]+)?\\s*$'
      AND ("amount_value" IS NULL OR "amount_value" <> "amount"::numeric)
  `)
  payload.logger.info(`add_transaction_amount_value: filled ${res.rowCount ?? 0} transaction(s)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "transactions_amount_value_idx";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "amount_value";
  `)
}
