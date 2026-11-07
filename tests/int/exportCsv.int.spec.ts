import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { transactionsCsv, csvCell } = await import('@/utilities/export/csv')

describe('CSV export', () => {
  let payload: Payload
  let user: User
  let account: string
  let cat: { id: string; name: string }
  const stamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({ collection: 'users', data: { email: `csv-${stamp}@example.com`, password: 'x-Test-12345', name: 'Csv' } as any })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: 'Asia/Calcutta' } as any })
    account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Federal' } as any })).id)
    const c = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0]
    cat = { id: String(c.id), name: String(c.name) }
    const mk = (title: string, amount: string, date: string, note = '') =>
      payload.create({ collection: 'transactions', user, overrideAccess: false, data: { title, amount, date, type: 'expense', account, category: cat.id, note } as any })
    await mk('Lunch, "team"', '450.50', '2026-11-05T07:00:00.000Z', 'line1\nline2')
    await mk('Rent', '7000', '2026-10-30T04:01:00.000Z')
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('escapes commas, quotes and newlines; neutralises formula cells', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('x\ny')).toBe('"x\ny"')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell(450.5)).toBe('450.5')
  })

  it('one row per matching transaction, newest first, in the user\'s timezone', async () => {
    const csv = await transactionsCsv(payload, String(user.id), {}, 'Asia/Calcutta')
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('Date,Time,Title,Type,Amount,Category,Account,To account,Person,Tags,Note,Source,Reference')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('2026-11-05,12:30,"Lunch, ""team""",expense,450.50,')
    expect(lines[1]).toContain(`${cat.name},Federal`)
    expect(lines[2]).toMatch(/^2026-10-30,09:31,Rent,expense,7000\.00,/)
  })

  it('takes the History where (GraphQL shape) and stays within the user', async () => {
    const csv = await transactionsCsv(payload, String(user.id), { OR: [{ title: { contains: 'rent' } }] }, 'Asia/Calcutta')
    expect(csv.trim().split('\r\n')).toHaveLength(2)
  })
})
