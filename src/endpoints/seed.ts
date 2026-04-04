import type { PayloadHandler } from 'payload'
import type { User } from '../payload-types'
import { reseed } from '../seed/init'

export const reseedHandler: PayloadHandler = async (req) => {
  const user = req.user as User | null
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await reseed(req.payload)
    return Response.json({ success: true, message: 'Reseed complete' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
