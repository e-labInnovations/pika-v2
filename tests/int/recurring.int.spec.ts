import { describe, it, expect } from 'vitest'
import { detectMonthly, nextMonthly, reminderTitle, seriesKey, titleKey, usualDay } from '@/utilities/recurring'

let n = 0
const tx = (title: string, amount: number, date: string, type = 'income', category = 'cat') => ({
  id: String(n++), title, type, amount, date: `${date}T06:30:00.000Z`, category, account: 'acc',
})
const now = new Date('2026-10-04T06:00:00Z')

describe('recurring detection', () => {
  it('finds a salary paid around month end, even on the 3rd of the next month', () => {
    const [s] = detectMonthly([
      tx('Salary (Jun 2026)', 99000, '2026-06-30'),
      tx('Salary (Jul 2026)', 99500, '2026-08-03'),
      tx('Salary (Aug 2026)', 109000, '2026-08-31'),
      tx('Salary (Sep 2026)', 109400, '2026-09-30'),
    ], now)
    expect(s).toMatchObject({ title: 'Salary', type: 'income', day: 31, occurrences: 4 })
    expect(s.nextDue.slice(0, 10)).toBe('2026-10-31')
  })

  it('uses the latest unbroken run and ignores older gaps', () => {
    const found = detectMonthly([
      tx('Rent', 8000, '2026-02-05', 'expense'),
      tx('Rent', 8000, '2026-07-05', 'expense'),
      tx('Rent', 8000, '2026-08-04', 'expense'),
      tx('Rent', 8000, '2026-09-05', 'expense'),
    ], now)
    expect(found.map((f) => [f.title, f.occurrences])).toEqual([['Rent', 3]])
  })

  it('skips habits, amounts that jump, and payments that stopped', () => {
    const coffee = ['07-02', '07-09', '07-20', '08-01', '08-10', '08-22', '09-03', '09-14', '09-25'].map((d) => tx('Coffee', 40, `2026-${d}`, 'expense'))
    const jumpy = [tx('Shop', 100, '2026-07-10', 'expense'), tx('Shop', 900, '2026-08-10', 'expense'), tx('Shop', 120, '2026-09-10', 'expense')]
    const stopped = [tx('Gym', 900, '2026-04-02', 'expense'), tx('Gym', 900, '2026-05-02', 'expense'), tx('Gym', 900, '2026-06-02', 'expense')]
    expect(detectMonthly([...coffee, ...jumpy, ...stopped], now)).toEqual([])
  })

  it('groups title variants into one series when given a series key', () => {
    const rent = [
      tx('Rent - Flat 7A (Jul 2026)', 7000, '2026-07-31', 'expense', 'rent'),
      tx('Flat rent - ASHER MATHEW', 7000, '2026-08-30', 'expense', 'rent'),
      tx('Rent - ASHER MATHEW', 7000, '2026-09-30', 'expense', 'rent'),
    ]
    expect(detectMonthly(rent, now)).toEqual([]) // three different exact titles
    const [s] = detectMonthly(rent, now, (t) => (t.category === 'rent' ? 'expense|rent|rent' : seriesKey(t)))
    expect(s).toMatchObject({ key: 'expense|rent|rent', title: 'Rent - ASHER MATHEW', occurrences: 3, day: 30 })
  })
})

describe('helpers', () => {
  it('usualDay wraps around the month end and rejects scattered days', () => {
    expect(usualDay([30, 31, 3, 30])).toBe(31)
    expect(usualDay([5, 6, 4])).toBe(5)
    expect(usualDay([2, 15, 28])).toBeNull()
  })

  it('nextMonthly clamps to the month length', () => {
    expect(nextMonthly(new Date('2026-01-31T06:30:00Z'), 31).slice(0, 10)).toBe('2026-02-28')
  })

  it('titles drop the month', () => {
    expect(reminderTitle('Salary - ThoughtSpot (Sep 2026)')).toBe('Salary - ThoughtSpot')
    expect(reminderTitle('Rent Oct 26')).toBe('Rent')
    expect(titleKey('Rent (Oct 2026)')).toBe(titleKey('Rent - Sep 2026'))
  })
})

describe('recurringOverview with tracked reminders', async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  const { recurringOverview } = await import('@/utilities/recurring')
  const payload = await getPayload({ config: await config })
  const stamp = Date.now()
  const user = (await payload.create({
    collection: 'users',
    data: { email: `rec-${stamp}@example.com`, password: 'x-Test-12345', name: 'Rec' } as any,
  })) as any
  const account = String((await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank' } as any })).id)
  const system = (await payload.find({ collection: 'users', where: { role: { equals: 'system' } }, limit: 1 })).docs[0]
  const category = String((await payload.find({
    collection: 'categories',
    where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }, { user: { equals: system.id } }] },
    limit: 1,
  })).docs[0].id)

  it('moves a paid reminder to next month, flags an unpaid one, and hides tracked patterns', async () => {
    const mk = (title: string, nextDueDate: string) =>
      payload.create({ collection: 'reminders', user, overrideAccess: false, data: { title, type: 'expense', amount: '800', isRecurring: true, recurrencePeriod: 1, recurrenceType: 'monthly', nextDueDate, category } as any })
    const rent = await mk('Rent', '2026-09-05T06:30:00.000Z')
    await mk('Mess', '2026-09-25T06:30:00.000Z')
    for (const d of ['07-05', '08-05', '09-06']) {
      await payload.create({ collection: 'transactions', user, overrideAccess: false, data: { title: `Rent (${d})`, amount: '800', type: 'expense', date: `2026-${d}T06:30:00.000Z`, account, category } as any })
    }

    const { suggestions, due } = await recurringOverview(payload, user, new Date('2026-10-01T06:00:00Z'))
    const after = await payload.findByID({ collection: 'reminders', id: rent.id, depth: 0 })
    expect(after.nextDueDate?.slice(0, 10)).toBe('2026-10-05')
    expect((after.completedDates as any[]).length).toBe(1)
    expect(due.map((d) => [d.title, d.status])).toEqual([['Mess', 'missing'], ['Rent', 'soon']])
    expect(suggestions.find((s) => s.title === 'Rent')).toBeUndefined()

    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'reminders', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })
})
