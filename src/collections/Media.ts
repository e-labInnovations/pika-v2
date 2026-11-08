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
  // Photos, PDFs and office/text documents (the app attaches any document). Not SVG, HTML
  // or scripts: opened from the admin they could run code. 20 MB max (payload.config).
  upload: {
    mimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
    ],
  },
}
