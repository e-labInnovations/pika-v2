import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { resuggestPendingSplits } from './20261108_000000_add_sms_split_parts'

/**
 * Re-runs the pending-SMS split suggestion. The first run (in add_sms_split_parts) read
 * past splits outside its transaction, before captured_sms_rels was committed, so the
 * read failed and no split was suggested. Idempotent.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const n = await resuggestPendingSplits(payload, req)
  payload.logger.info(`resuggest_sms_splits: updated ${n} pending SMS suggestion(s)`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Suggestions only; nothing to undo.
}
