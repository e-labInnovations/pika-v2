import type { CollectionConfig } from 'payload'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'
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
    afterChange: [seedOnFirstUser],
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
