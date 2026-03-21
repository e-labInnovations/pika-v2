import type { Access } from 'payload'

export const ownOrSystemRecords: Access = async ({ req: { user, payload } }) => {
  if (!user) return false
  if (user.role === 'admin') return true

  const found = await payload.find({
    collection: 'users',
    where: { role: { equals: 'system' } },
    limit: 100,
    depth: 0,
  })

  const sysIds = found.docs.map((u) => u.id)

  if (!sysIds.length) return { user: { equals: user.id } }

  return { or: [{ user: { equals: user.id } }, { user: { in: sysIds } }] }
}
