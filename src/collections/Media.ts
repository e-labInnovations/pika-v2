import type { Access, CollectionAfterReadHook, CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields/userField'
import { signMediaToken } from '@/lib/mediaToken'
import { resolveUser } from '@/access/isUser'
import jwt from 'jsonwebtoken'

const attachFileReadToken: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!req.user || !doc?.filename) return null

  const token = signMediaToken({
    id: doc.id,
    filename: doc.filename,
    secret: req.payload.secret,
  })

  doc.url = `${doc.url}?token=${token}`
  return doc
}

const readAccess: Access = ({ req }) => {
  const { user } = req

  // Authenticated user
  if (user) {
    const resolved = resolveUser(user)
    if (resolved?.role === 'admin') return true
    return { user: { equals: user.id } }
  }

  // Unauthenticated — check for token on file serve route
  const url = new URL(req.url ?? '')
  const isFileRoute = /^\/api\/media\/file\/[^/]+$/.test(url.pathname)
  if (!isFileRoute) return false

  const token = url.searchParams.get('token')
  if (!token) return false

  try {
    jwt.verify(token, req.payload.secret)
    return true
  } catch {
    return false
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: isNotSystem,
    read: readAccess,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate],
    afterRead: [attachFileReadToken],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'type',
      type: 'select',
      options: ['avatar', 'attachment', 'other'],
      defaultValue: 'other',
    },
    {
      name: 'entityType',
      type: 'select',
      options: ['person', 'account', 'transaction', 'other'],
      defaultValue: 'other',
    },
    userField,
  ],
  upload: true,
}
