import type { PayloadHandler } from 'payload'
import type { User } from '../payload-types'
import { seedRandomData } from '../seed/randomSeed'

export const randomSeedHandler: PayloadHandler = async (req) => {
  const user = req.user as User | null
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json?.().catch(() => ({})) ?? {}
    const people = Math.max(1, Math.min(20, Number(body?.people) || 6))
    const transactions = Math.max(1, Math.min(100, Number(body?.transactions) || 30))

    const log = await seedRandomData(req.payload, user.id as string, { people, transactions })
    return Response.json({ success: true, log })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
