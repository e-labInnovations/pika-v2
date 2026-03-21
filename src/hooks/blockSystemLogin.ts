import type { CollectionBeforeOperationHook } from 'payload'

export const blockSystemLogin: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'login') return args

  const email = args?.data?.email as string | undefined
  if (!email) return args

  const result = await req.payload.find({
    collection: 'users',
    where: { and: [{ email: { equals: email } }, { role: { equals: 'system' } }] },
    limit: 1,
    depth: 0,
  })

  if (result.totalDocs > 0) throw new Error('Login not permitted for this account.')

  return args
}
