import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook } from 'payload'

export const preventDeleteIfUsedInTransactions = (field: string): CollectionBeforeDeleteHook =>
  async ({ id, req }) => {
    const result = await req.payload.find({
      collection: 'transactions',
      where: { [field]: { equals: id } },
      limit: 1,
      depth: 0,
    })
    if (result.totalDocs > 0) {
      throw new APIError(
        `Cannot delete: this record is referenced by ${result.totalDocs} transaction(s). Remove it from all transactions first.`,
        400,
        null,
        true,
      )
    }
  }
