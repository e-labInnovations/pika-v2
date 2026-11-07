import type { PayloadHandler } from 'payload'
import { transactionsCsv } from '../utilities/export/csv'
import { getUserTimezone } from '../utilities/getUserTimezone'

/**
 * POST /api/export/transactions { where? } → CSV of the signed-in user's transactions
 * matching the History list's where (GraphQL shape). Newest first.
 */
export const exportTransactionsHandler: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { where?: Record<string, unknown> | null } = {}
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  try {
    const csv = await transactionsCsv(req.payload, String(req.user.id), body.where ?? null, await getUserTimezone(req))
    const day = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pika-transactions-${day}.csv"`,
      },
    })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'Export failed' }, { status: e?.status ?? 400 })
  }
}
