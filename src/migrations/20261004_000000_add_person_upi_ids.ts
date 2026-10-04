import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// people.upi_ids: UPI IDs / SMS payee names used to detect the person on captured SMS. Idempotent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "upi_ids" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "people" DROP COLUMN IF EXISTS "upi_ids";`)
}
