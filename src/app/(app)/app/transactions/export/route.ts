import { NextResponse, type NextRequest } from 'next/server'

import { getSession } from '@/lib/session'
import { parseTxParams, toWhere } from '@/lib/web/filters'
import { localDay } from '@/lib/web/format'
import { loadLookups } from '@/lib/web/transactions'
import { transactionsCsv } from '@/utilities/export/csv'

/** GET /app/transactions/export?<list filters> → CSV of every matching transaction. */
export async function GET(request: NextRequest) {
  const { payload, user, timeZone: tz } = await getSession()
  if (!user) return NextResponse.redirect(new URL('/app/login', request.url))
  const query = parseTxParams(Object.fromEntries(request.nextUrl.searchParams))
  const lookups = await loadLookups(payload, user)
  const where = toWhere(query, { userId: String(user.id), timeZone: tz, childrenOf: lookups.childrenOf })
  const csv = await transactionsCsv(payload, String(user.id), where as Record<string, unknown>, tz)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="pika-transactions-${localDay(new Date(), tz)}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
