import type { CollectionConfig, Access, Where } from 'payload'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { blockSystemLogin } from '../hooks/blockSystemLogin'
import { isAdmin } from '@/access/isAdmin'
import { isUser, resolveUser } from '@/access/isUser'
import { onInit } from '@/seed/init'

// Users are identified by their own `id`, not a `user` relationship field.
// System users must also be readable so relationship fields on shared records resolve correctly.
const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  const resolved = resolveUser(user)
  if (resolved?.role === 'admin') return true
  return {
    or: [{ id: { equals: user.id } }, { role: { equals: 'system' } }],
  } as Where
}

const promoteFirstUser: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const existing = await req.payload.find({
    collection: 'users',
    where: { role: { not_equals: 'system' } },
    limit: 1,
    depth: 0,
  })

  if (existing.totalDocs === 0) {
    data.role = 'admin'
  }

  return data
}

const protectLastAdmin: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  if (operation !== 'update') return data
  if (originalDoc?.role !== 'admin') return data
  if (data.role === 'admin') return data

  const existing = await req.payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 2,
  })

  if (existing.totalDocs === 1) {
    throw new Error('Cannot remove the last admin user.')
  }

  return data
}

const createDefaultSettings: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if (doc.role === 'system') return doc

  const existing = await req.payload.find({
    collection: 'user-settings',
    where: { user: { equals: doc.id } },
    limit: 1,
    depth: 0,
    req,
  })
  if (existing.totalDocs > 0) return doc

  await req.payload.create({
    collection: 'user-settings',
    data: { user: doc.id },
    overrideAccess: true,
    req,
    context: { overrideUserId: doc.id },
  })

  return doc
}

const deleteUserSettings: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const existing = await req.payload.find({
    collection: 'user-settings',
    where: { user: { equals: doc.id } },
    limit: 1,
    depth: 0,
  })
  if (existing.totalDocs === 0) return
  await req.payload.delete({
    collection: 'user-settings',
    where: { user: { equals: doc.id } },
  })
}

const seedOnFirstUser: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if (doc.role !== 'admin') return doc
  await onInit(req.payload)
  return doc
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    tokenExpiration: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  access: {
    create: () => true,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: ({ req: { user } }) => isUser(user) && user.role === 'admin',
  },
  hooks: {
    beforeOperation: [blockSystemLogin],
    beforeChange: [promoteFirstUser, protectLastAdmin],
    afterChange: [createDefaultSettings, seedOnFirstUser],
    afterDelete: [deleteUserSettings],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'settings',
      type: 'join',
      collection: 'user-settings',
      on: 'user',
      maxDepth: 1,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
        { label: 'System', value: 'system' },
      ],
      defaultValue: 'user',
      required: true,
      saveToJWT: true,
      access: {
        update: ({ req: { user } }) => isUser(user) && user.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => Boolean(user),
      },
    },
  ],
}
