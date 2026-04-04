import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook } from 'payload'

export const preventDeleteParentCategory: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const result = await req.payload.find({
    collection: 'categories',
    where: { parent: { equals: id } },
    limit: 1,
    depth: 0,
  })
  if (result.totalDocs > 0) {
    throw new APIError(
      `Cannot delete: this category has ${result.totalDocs} subcategory(ies). Delete all subcategories first.`,
      400,
      null,
      true,
    )
  }
}
