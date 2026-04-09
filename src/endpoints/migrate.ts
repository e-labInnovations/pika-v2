import type { PayloadHandler } from 'payload'

/**
 * POST /api/migrate/connect
 * Validates credentials against the old Pika REST API.
 * Body: { url: string, username: string, appPassword: string }
 */
export const migrateConnectHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { url?: string; username?: string; appPassword?: string } = {}
  try {
    body = await req.json?.()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, username, appPassword } = body

  if (!url || !username || !appPassword) {
    return Response.json({ error: 'url, username and appPassword are required' }, { status: 400 })
  }

  const baseUrl = url.replace(/\/$/, '')
  const authToken = Buffer.from(`${username}:${appPassword}`).toString('base64')
  const authHeader = `Basic ${authToken}`

  try {
    const res = await fetch(`${baseUrl}/wp-json/pika/v1/auth/me`, {
      headers: {
        Authorization: authHeader,
        Cookie: `pika_token=${authToken}`,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Old Pika returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 400 },
      )
    }

    const data = await res.json()
    return Response.json({ ok: true, user: data })
  } catch (err) {
    return Response.json(
      { error: `Cannot reach old Pika: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }
}

/**
 * POST /api/migrate/fetch
 * Proxies a GET request to the old Pika API.
 * Body: { url, username, appPassword, resource, params? }
 */
export const migrateFetchHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    url?: string
    username?: string
    appPassword?: string
    resource?: string
    params?: Record<string, string>
  } = {}
  try {
    body = await req.json?.()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, username, appPassword, resource, params = {} } = body
  const ALLOWED_RESOURCES = ['accounts', 'categories', 'tags', 'people', 'transactions']

  if (!url || !username || !appPassword || !resource) {
    return Response.json(
      { error: 'url, username, appPassword, resource are required' },
      { status: 400 },
    )
  }

  if (!ALLOWED_RESOURCES.includes(resource)) {
    return Response.json(
      { error: `resource must be one of: ${ALLOWED_RESOURCES.join(', ')}` },
      { status: 400 },
    )
  }

  const baseUrl = url.replace(/\/$/, '')
  const authToken = Buffer.from(`${username}:${appPassword}`).toString('base64')
  const authHeader = `Basic ${authToken}`
  const qs = new URLSearchParams(params).toString()
  const apiUrl = `${baseUrl}/wp-json/pika/v1/${resource}${qs ? `?${qs}` : ''}`

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: authHeader,
        Cookie: `pika_token=${authToken}`,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Old Pika returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 400 },
      )
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    return Response.json(
      { error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}

type AccountMapping = {
  action: 'create' | 'skip' | 'use_existing'
  oldId: number | string
  existingId?: string
  name?: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
  avatarAction?: 'skip' | 'upload_new' | 'override_existing' | 'keep_existing'
  oldAvatarUrl?: string
  avatarName?: string
}

type TagMapping = {
  action: 'create' | 'skip' | 'use_existing'
  oldId: number | string
  existingId?: string
  name?: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
}

type PersonMapping = {
  action: 'create' | 'skip' | 'use_existing'
  oldId: number | string
  existingId?: string
  name?: string
  email?: string
  phone?: string
  description?: string
  avatarAction?: 'skip' | 'upload_new' | 'override_existing' | 'keep_existing'
  oldAvatarUrl?: string
  avatarName?: string
}

type CategoryMapping = {
  action: 'create' | 'skip' | 'use_existing'
  oldId: number | string
  existingId?: string
  name?: string
  icon?: string
  color?: string
  bgColor?: string
  description?: string
  type?: string
  parentOldId?: number | string | null
  newParentId?: string | null
}

type TransactionMapping = {
  title: string
  amount: string
  date: string
  type: 'income' | 'expense' | 'transfer'
  categoryV2Id?: string
  accountV2Id: string
  toAccountV2Id?: string
  personV2Id?: string
  tagV2Ids?: string[]
  note?: string
  oldAttachments?: Array<{ id: number; url: string; name: string; size: number }>
}

type MigrateRunBody = {
  step?: string
  userId?: string
  mappings?: unknown[]
}

async function fetchAndUploadMedia(
  url: string,
  name: string | undefined,
  type: 'avatar' | 'attachment',
  entityType: 'person' | 'account' | 'transaction',
  req: any,
  payload: any,
  userId: string,
) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const mimetype = res.headers.get('content-type') || 'application/octet-stream'

    let finalName = name
    if (!finalName) {
      const ext = mimetype.split('/')[1] || 'img'
      finalName = `migration_${Date.now()}.${ext}`
    }

    const doc = await payload.create({
      collection: 'media',
      data: {
        alt: finalName,
        type,
        entityType,
        user: userId,
      },
      file: {
        data: buffer,
        name: finalName,
        mimetype,
        size: buffer.byteLength,
      },
      req,
    })
    return String(doc.id)
  } catch (err) {
    console.warn(`[Migration] Failed to upload media from ${url}:`, err)
    return undefined
  }
}

/**
 * POST /api/migrate/run
 * Executes a single migration step.
 * Body: { step, userId, mappings }
 */
export const migrateRunHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: MigrateRunBody = {}
  try {
    body = await req.json?.()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { step, mappings = [] } = body

  if (!step) {
    return Response.json({ error: 'step is required' }, { status: 400 })
  }

  const payload = req.payload
  const userId = String(req.user.id)
  let createdCount = 0
  let skippedCount = 0
  const failed: string[] = []
  const idMap: Record<string | number, string> = {}

  try {
    if (step === 'accounts') {
      for (const mapping of mappings as AccountMapping[]) {
        if (mapping.action === 'skip') {
          skippedCount++
          continue
        }
        if (mapping.action === 'use_existing' && mapping.existingId) {
          idMap[mapping.oldId] = mapping.existingId

          if (
            (mapping.avatarAction === 'override_existing' ||
              mapping.avatarAction === 'upload_new') &&
            mapping.oldAvatarUrl
          ) {
            try {
              const mediaId = await fetchAndUploadMedia(
                mapping.oldAvatarUrl,
                mapping.avatarName,
                'avatar',
                'account',
                req,
                payload,
                userId,
              )
              if (mediaId) {
                await payload.update({
                  collection: 'accounts',
                  id: mapping.existingId,
                  data: { avatar: mediaId },
                  req,
                })
              }
            } catch (err) {
              failed.push(
                `${mapping.oldId} (Avatar update): ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }

          skippedCount++
          continue
        }
        try {
          let avatarId: string | undefined = undefined
          if (
            (mapping.avatarAction === 'upload_new' ||
              mapping.avatarAction === 'override_existing') &&
            mapping.oldAvatarUrl
          ) {
            avatarId = await fetchAndUploadMedia(
              mapping.oldAvatarUrl,
              mapping.avatarName,
              'avatar',
              'account',
              req,
              payload,
              userId,
            )
          }

          const doc = await payload.create({
            collection: 'accounts',
            data: {
              user: userId,
              name: mapping.name || 'Imported Account',
              icon: mapping.icon || 'wallet',
              color: mapping.color || '#ffffff',
              bgColor: mapping.bgColor || '#3B82F6',
              description: mapping.description || '',
              avatar: avatarId,
              isActive: true,
            },
            req,
          })
          idMap[mapping.oldId] = String(doc.id)
          createdCount++
        } catch (err) {
          failed.push(`${mapping.oldId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    if (step === 'tags') {
      for (const mapping of mappings as TagMapping[]) {
        if (mapping.action === 'skip') {
          skippedCount++
          continue
        }
        if (mapping.action === 'use_existing' && mapping.existingId) {
          idMap[mapping.oldId] = mapping.existingId
          skippedCount++
          continue
        }
        try {
          const doc = await payload.create({
            collection: 'tags',
            data: {
              user: userId,
              name: mapping.name || 'Imported Tag',
              icon: mapping.icon || 'tag',
              color: mapping.color || '#ffffff',
              bgColor: mapping.bgColor || '#6366f1',
              description: mapping.description || '',
              isActive: true,
            },
            req,
          })
          idMap[mapping.oldId] = String(doc.id)
          createdCount++
        } catch (err) {
          failed.push(`${mapping.oldId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    if (step === 'people') {
      for (const mapping of mappings as PersonMapping[]) {
        if (mapping.action === 'skip') {
          skippedCount++
          continue
        }
        if (mapping.action === 'use_existing' && mapping.existingId) {
          idMap[mapping.oldId] = mapping.existingId

          if (
            (mapping.avatarAction === 'override_existing' ||
              mapping.avatarAction === 'upload_new') &&
            mapping.oldAvatarUrl
          ) {
            try {
              const mediaId = await fetchAndUploadMedia(
                mapping.oldAvatarUrl,
                mapping.avatarName,
                'avatar',
                'person',
                req,
                payload,
                userId,
              )
              if (mediaId) {
                await payload.update({
                  collection: 'people',
                  id: mapping.existingId,
                  data: { avatar: mediaId },
                  req,
                })
              }
            } catch (err) {
              failed.push(
                `${mapping.oldId} (Avatar update): ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }

          skippedCount++
          continue
        }
        try {
          let avatarId: string | undefined = undefined
          if (
            (mapping.avatarAction === 'upload_new' ||
              mapping.avatarAction === 'override_existing') &&
            mapping.oldAvatarUrl
          ) {
            avatarId = await fetchAndUploadMedia(
              mapping.oldAvatarUrl,
              mapping.avatarName,
              'avatar',
              'person',
              req,
              payload,
              userId,
            )
          }

          const doc = await payload.create({
            collection: 'people',
            data: {
              user: userId,
              name: mapping.name || 'Imported Person',
              email: mapping.email || undefined,
              phone: mapping.phone || undefined,
              description: mapping.description || '',
              avatar: avatarId,
              isActive: true,
            },
            req,
          })
          idMap[mapping.oldId] = String(doc.id)
          createdCount++
        } catch (err) {
          failed.push(`${mapping.oldId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    if (step === 'categories') {
      const categoryMappings = mappings as CategoryMapping[]
      const parents = categoryMappings.filter((m) => !m.parentOldId)
      const children = categoryMappings.filter((m) => m.parentOldId)

      for (const mapping of [...parents, ...children]) {
        if (mapping.action === 'skip') {
          skippedCount++
          continue
        }
        if (mapping.action === 'use_existing' && mapping.existingId) {
          idMap[mapping.oldId] = mapping.existingId
          skippedCount++
          continue
        }
        const parentId = mapping.parentOldId
          ? idMap[mapping.parentOldId] || mapping.newParentId || undefined
          : undefined
        try {
          const doc = await payload.create({
            collection: 'categories',
            data: {
              user: userId,
              name: mapping.name || 'Imported Category',
              icon: mapping.icon || 'folder',
              color: mapping.color || '#ffffff',
              bgColor: mapping.bgColor || '#6366f1',
              description: mapping.description || '',
              type: (mapping.type as 'income' | 'expense' | 'transfer') || 'expense',
              parent: parentId,
              isActive: true,
            },
            req,
          })
          idMap[mapping.oldId] = String(doc.id)
          createdCount++
        } catch (err) {
          failed.push(`${mapping.oldId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    if (step === 'transactions') {
      for (const mapping of mappings as TransactionMapping[]) {
        try {
          if (!mapping.categoryV2Id) {
            failed.push(`"${mapping.title}": category is required but was not mapped`)
            continue
          }
          const attachmentIds: string[] = []
          if (mapping.oldAttachments && mapping.oldAttachments.length > 0) {
            for (const att of mapping.oldAttachments) {
              const mediaId = await fetchAndUploadMedia(
                att.url,
                att.name,
                'attachment',
                'transaction',
                req,
                payload,
                userId,
              )
              if (mediaId) attachmentIds.push(mediaId)
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txData: Record<string, any> = {
            user: userId,
            title: mapping.title,
            amount: String(mapping.amount),
            date: mapping.date,
            type: mapping.type,
            category: mapping.categoryV2Id,
            account: mapping.accountV2Id,
            isActive: true,
          }
          if (mapping.toAccountV2Id) txData.toAccount = mapping.toAccountV2Id
          if (mapping.personV2Id) txData.person = mapping.personV2Id
          if (mapping.tagV2Ids?.length) txData.tags = mapping.tagV2Ids
          if (mapping.note) txData.note = mapping.note
          if (attachmentIds.length > 0) txData.attachments = attachmentIds

          await payload.create({
            collection: 'transactions',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: txData as any,
            overrideAccess: true,
            req,
          })
          createdCount++
        } catch (err) {
          failed.push(err instanceof Error ? err.message : String(err))
        }
      }
    }

    return Response.json({
      ok: true,
      step,
      created: createdCount,
      skipped: skippedCount,
      failed: failed.length,
      errors: failed,
      idMap,
    })
  } catch (err) {
    return Response.json(
      {
        error: `Migration step ${step} failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    )
  }
}
