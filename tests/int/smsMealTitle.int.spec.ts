import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'
import { fixMealWord, mealFor } from '@/utilities/sms/mealTitle'
import { ingestSms } from '@/utilities/sms/ingest'
import { confirmCapturedSms } from '@/utilities/sms/confirm'
import { fixPendingMealTitles } from '@/migrations/20261105_000000_fix_sms_meal_titles'

const IST = 'Asia/Calcutta'
/** A Date for the given IST wall-clock time on 2026-11-05. */
const ist = (hhmm: string) => new Date(`2026-11-05T${hhmm}:00+05:30`)

describe('meal word for the time of day', () => {
  it.each([
    ['05:00', 'Breakfast'],
    ['10:59', 'Breakfast'],
    ['11:00', 'Lunch'],
    ['15:59', 'Lunch'],
    ['16:00', 'Evening'],
    ['18:59', 'Evening'],
    ['19:00', 'Dinner'],
    ['04:59', 'Dinner'],
  ])('%s IST is %s', (t, meal) => {
    expect(mealFor(ist(t), IST)).toBe(meal)
  })

  it('uses the given time zone', () => {
    expect(mealFor(ist('12:07'), 'Europe/London')).toBe('Breakfast')
  })

  it('reads a missing or UTC timezone as India time: bank SMS times are IST', () => {
    expect(mealFor(ist('12:07'), 'UTC')).toBe('Lunch')
    expect(mealFor(ist('12:07'), '')).toBe('Lunch')
  })

  it('replaces a leading meal word and keeps the rest', () => {
    expect(fixMealWord('Dinner - Zomato order', ist('12:07'), IST)).toBe('Lunch - Zomato order')
    expect(fixMealWord('Breakfast coffee and banana fry', ist('17:12'), IST)).toBe('Evening coffee and banana fry')
    expect(fixMealWord(' Breakfast snacks - Malabar Bite', ist('09:09'), IST)).toBe('Breakfast snacks - Malabar Bite')
    expect(fixMealWord('lunch', ist('20:00'), IST)).toBe('dinner')
    expect(fixMealWord('SUPPER', ist('13:00'), IST)).toBe('LUNCH')
  })

  it('leaves titles that do not start with a meal word', () => {
    expect(fixMealWord('Zomato dinner box', ist('12:07'), IST)).toBe('Zomato dinner box')
    expect(fixMealWord('Lunchbox refill', ist('20:00'), IST)).toBe('Lunchbox refill')
  })
})

const upi = (amt: string, to: string, ref: string, when: string) =>
  `Debited Rs ${amt} from a/c X5556 on ${when} via UPI to ${to}. Ref ${ref}.Bal Rs 1000.00. Not you?Call 18004251199 -Federal Bank`

describe('SMS suggestions reuse past titles with the right meal word', () => {
  let payload: Payload
  let user: User
  const stamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email: `meal-${stamp}@example.com`, password: 'x-Test-12345', name: 'Meal' } as any,
    })) as User
    await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: IST } as any })
    await payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name: 'Bank', smsIdentifiers: 'X5556' } as any })
    const c = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1 })).docs[0]

    // Last night's order at this merchant was confirmed as dinner.
    const [first] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi('250.00', 'MEAL TEST CAFE', `6271${stamp % 1e8}`, '04Nov26 20:30'), receivedAt: '2026-11-04T15:00:30Z' },
    ])
    await confirmCapturedSms(payload, user, first.id!, { title: 'Dinner - Meal Test Cafe', category: String(c.id) })
  })

  afterAll(async () => {
    const where = { user: { equals: user.id } }
    await payload.delete({ collection: 'captured-sms', where })
    await payload.delete({ collection: 'transactions', where, trash: true } as any)
    await payload.delete({ collection: 'accounts', where })
    await payload.delete({ collection: 'user-settings', where })
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('a lunchtime order gets "Lunch", not the learned "Dinner"', async () => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi('180.00', 'MEAL TEST CAFE', `6272${stamp % 1e8}`, '05Nov26 12:07'), receivedAt: '2026-11-05T06:37:30Z' },
    ])
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    expect(sms.suggestion).toMatchObject({ title: 'Lunch - Meal Test Cafe', from: 'sms' })
  })

  it('the migration corrects pending items saved with the wrong meal word', async () => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: 'AD-FEDBNK-S', body: upi('90.00', 'MEAL TEST CAFE', `6273${stamp % 1e8}`, '05Nov26 12:30'), receivedAt: '2026-11-05T07:00:30Z' },
    ])
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    // As saved before the fix.
    await payload.update({
      collection: 'captured-sms',
      id: r.id!,
      data: { suggestion: { ...(sms.suggestion as object), title: 'Dinner - Meal Test Cafe' } } as any,
    })

    expect(await fixPendingMealTitles(payload)).toBeGreaterThanOrEqual(1)
    const fixed = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    expect((fixed.suggestion as { title: string }).title).toBe('Lunch - Meal Test Cafe')

    // The confirmed one keeps its title, and a second run has nothing to do for this user.
    const confirmed = await payload.find({ collection: 'captured-sms', where: { and: [{ user: { equals: user.id } }, { status: { equals: 'confirmed' } }] }, depth: 1 })
    expect((confirmed.docs[0].transaction as { title: string }).title).toBe('Dinner - Meal Test Cafe')
    const again = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    await fixPendingMealTitles(payload)
    expect((await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })).updatedAt).toBe(again.updatedAt)
  })
})
