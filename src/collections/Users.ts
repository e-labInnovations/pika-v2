import type { CollectionConfig } from 'payload'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { blockSystemLogin } from '../hooks/blockSystemLogin'
import { isAdminOrOwn } from '@/access/isAdminOrOwn'
import { isAdmin } from '@/access/isAdmin'
import { isUser } from '@/access/isUser'
import { onInit } from '@/seed/init'

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
  auth: true,
  access: {
    create: () => true,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
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
