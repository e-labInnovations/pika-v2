import type { PayloadRequest } from 'payload'

export async function getUserTimezone(req: PayloadRequest): Promise<string> {
  if (!req.user) return 'UTC'
  try {
    const settings = await req.payload.find({
      collection: 'user-settings',
      where: { user: { equals: req.user.id } },
      limit: 1,
      depth: 0,
      context: { internal: true },
    })
    return (settings.docs[0]?.timezone as string) || 'UTC'
  } catch {
    return 'UTC'
  }
}
