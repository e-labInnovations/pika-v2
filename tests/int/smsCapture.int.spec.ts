import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'
import { ingestSms } from '@/utilities/sms/ingest'
import { confirmCapturedSms, dismissCapturedSms, payeeBelongsTo, undoAutoConfirmedSms } from '@/utilities/sms/confirm'

const F = 'AD-FEDBNK-S'
const P = 'JM-Pluxee-S'
const upi = (amt: string, to: string, ref: string, when = '28Sep26 08:56') =>
  `Debited Rs ${amt} from a/c X4321 on ${when} via UPI to ${to}. Ref ${ref}.Bal Rs 1000.00. Not you?Call 18004251199 -Federal Bank`

describe('SMS capture flow', () => {
  let payload: Payload
  let user: User
  let other: User
  let bank: string
  let meal: string
  let expenseCat: string
  let incomeCat: string
  const stamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mk = (tag: string) =>
      payload.create({ collection: 'users', data: { email: `sms-${tag}-${stamp}@example.com`, password: 'x-Test-12345', name: `SMS ${tag}` } as any })
    user = (await mk('a')) as User
    other = (await mk('b')) as User
    const acct = (name: string, smsIdentifiers: string) =>
      payload.create({ collection: 'accounts', user, overrideAccess: false, data: { name, smsIdentifiers } as any })
    bank = String((await acct('Test Bank', 'X4321')).id)
    meal = String((await acct('Test Meal', 'xx8765, pluxee-meal')).id)
    const cat = async (type: string) =>
      String((await payload.find({ collection: 'categories', where: { and: [{ type: { equals: type } }, { parent: { exists: true } }] }, limit: 1 })).docs[0].id)
    expenseCat = await cat('expense')
    incomeCat = await cat('income')
  })

  afterAll(async () => {
    for (const u of [user, other].filter(Boolean)) {
      const where = { user: { equals: u.id } }
      await payload.delete({ collection: 'captured-sms', where })
      await payload.delete({ collection: 'transaction-links', where })
      await payload.delete({ collection: 'transactions', where, trash: true } as any)
      await payload.delete({ collection: 'accounts', where })
      await payload.delete({ collection: 'people', where })
      await payload.delete({ collection: 'user-settings', where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('ingests a debit as pending, on the right account, and ignores a resend', async () => {
    const msg = { sender: F, body: upi('45.00', 'HOTEL SAMPLE', '627100000101'), receivedAt: '2026-09-28T03:26:30Z' }
    const [r] = await ingestSms(payload, String(user.id), [msg])
    expect(r.status).toBe('pending')
    expect(r.summary).toMatchObject({ amount: '45.00', type: 'expense', title: 'Hotel Sample' })
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    expect(sms.account).toBe(bank)
    expect((sms.suggestion as any).title).toBe('Hotel Sample')

    const [again] = await ingestSms(payload, String(user.id), [{ ...msg, sender: 'AX-FEDBNK' }])
    expect(again).toMatchObject({ status: 'exists', id: r.id })
  })

  it('drops other senders and non-transaction messages', async () => {
    const res = await ingestSms(payload, String(user.id), [
      { sender: 'AT-AIRTEL', body: 'Rs 399 recharge done', receivedAt: '2026-09-28T03:00:00Z' },
      { sender: F, body: '201777 is OTP for txn of INR 860.00 -Federal Bank', receivedAt: '2026-09-28T03:00:00Z' },
    ])
    expect(res.map((r) => r.status)).toEqual(['ignored', 'ignored'])
  })

  it('confirms into a transaction, then learns the merchant for the next SMS', async () => {
    const pending = await payload.find({ collection: 'captured-sms', where: { user: { equals: user.id }, status: { equals: 'pending' } } })
    const { transaction } = await confirmCapturedSms(payload, user, String(pending.docs[0].id), {
      title: 'Breakfast', category: expenseCat,
    })
    const tx = await payload.findByID({ collection: 'transactions', id: transaction, depth: 0 })
    expect(tx).toMatchObject({ title: 'Breakfast', type: 'expense', account: bank, source: 'sms', externalRef: '627100000101' })
    expect(parseFloat(tx.amount as string)).toBe(45)
    expect(tx.date).toBe('2026-09-28T03:26:00.000Z')

    const [next] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('50.00', 'HOTEL SAMPLE', '627100000102', '29Sep26 08:50'), receivedAt: '2026-09-29T03:20:30Z' },
    ])
    const sms = await payload.findByID({ collection: 'captured-sms', id: next.id!, depth: 0 })
    expect(sms.suggestion).toMatchObject({ title: 'Breakfast', category: expenseCat, from: 'sms' })
  })

  it('marks an SMS for a payment already entered (ref in the note) as duplicate', async () => {
    const existing = await payload.create({
      collection: 'transactions', user, overrideAccess: false,
      data: { title: 'Lunch', amount: '120', date: '2026-09-30T07:00:00Z', type: 'expense', category: expenseCat, account: bank, note: 'UPI ref 627100000103 to CAFE' } as any,
    })
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('120.00', 'CAFE', '627100000103', '30Sep26 12:30'), receivedAt: '2026-09-30T07:00:30Z' },
    ])
    expect(r.status).toBe('duplicate')
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    expect(sms.transaction).toBe(existing.id)
    await expect(confirmCapturedSms(payload, user, r.id!, { category: expenseCat })).rejects.toThrow(/duplicate/)
  })

  it('a Pluxee refund is linked to the purchase it reverses', async () => {
    const [spend, refund] = await ingestSms(payload, String(user.id), [
      { sender: P, body: 'Rs. 92.75 spent from Pluxee  Meal wallet, card no.xx8765 on 01-05-2026 09:42:42 at SWIGGY . Avl bal Rs.500.00. Not you call 18002106919', receivedAt: '2026-05-01T04:12:50Z' },
      { sender: P, body: 'Your Pluxee Card xx8765 has been credited with INR 92.75 on Fri May 01 2026 12:47:11as a reversal against a previous transaction on May 01,2026 09:42:42.', receivedAt: '2026-05-01T07:17:20Z' },
    ])
    const s1 = await payload.findByID({ collection: 'captured-sms', id: spend.id!, depth: 0 })
    expect(s1.account).toBe(meal)
    const bought = await confirmCapturedSms(payload, user, spend.id!, { title: 'Swiggy', category: expenseCat })
    const back = await confirmCapturedSms(payload, user, refund.id!, { category: incomeCat })
    expect(back.linked).toBe(bought.transaction)
    const links = await payload.find({ collection: 'transaction-links', where: { from: { equals: back.transaction } }, depth: 0 })
    expect(links.docs[0]).toMatchObject({ to: bought.transaction, type: 'returned' })
  })

  it('requires a category when there is no suggestion, and supports dismiss', async () => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('999.00', 'UNKNOWN SHOP XYZ', '627100000104', '30Sep26 20:00'), receivedAt: '2026-09-30T14:30:30Z' },
    ])
    const sms = await payload.findByID({ collection: 'captured-sms', id: r.id!, depth: 0 })
    if (!(sms.suggestion as any)?.category) {
      await expect(confirmCapturedSms(payload, user, r.id!)).rejects.toThrow(/category/i)
    }
    await dismissCapturedSms(payload, user, r.id!)
    await expect(confirmCapturedSms(payload, user, r.id!, { category: expenseCat })).rejects.toThrow(/dismissed/)
  })

  it("another user cannot confirm or dismiss someone else's SMS", async () => {
    const [r] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('10.00', 'TEA STALL', '627100000105', '30Sep26 21:00'), receivedAt: '2026-09-30T15:30:30Z' },
    ])
    await expect(confirmCapturedSms(payload, other, r.id!, { category: expenseCat })).rejects.toThrow()
    await expect(dismissCapturedSms(payload, other, r.id!)).rejects.toThrow()
    const own = await payload.find({ collection: 'captured-sms', user: other, overrideAccess: false })
    expect(own.totalDocs).toBe(0)
  })

  it('fills in the person from their UPI IDs / SMS names, and learns new ones on confirm', async () => {
    const mkPerson = (name: string, upiIds?: string) =>
      payload.create({ collection: 'people', user, overrideAccess: false, data: { name, upiIds } as any })
    const eliz = await mkPerson('Elizebeth Shaji', 'eliz@okaxis')
    const ashar = await mkPerson('Ashar Mathew')

    const [r1] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('500.00', 'ELIZ@OKAXIS', '627100000201', '01Oct26 10:00'), receivedAt: '2026-10-01T04:30:30Z' },
    ])
    const s1 = await payload.findByID({ collection: 'captured-sms', id: r1.id!, depth: 0 })
    expect(s1.suggestion).toMatchObject({ person: eliz.id, title: 'Paid Elizebeth Shaji' })

    // Picking Ashar for a payment to "ASHAR M" teaches that name; a shop paid for him does not.
    const [r2, r3] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('300.00', 'ASHAR M', '627100000202', '01Oct26 11:00'), receivedAt: '2026-10-01T05:30:30Z' },
      { sender: F, body: upi('80.00', 'HOTEL AKSHAY', '627100000203', '01Oct26 12:00'), receivedAt: '2026-10-01T06:30:30Z' },
    ])
    await confirmCapturedSms(payload, user, r2.id!, { category: expenseCat, person: String(ashar.id) })
    await confirmCapturedSms(payload, user, r3.id!, { category: expenseCat, person: String(ashar.id) })
    const learned = await payload.findByID({ collection: 'people', id: ashar.id, depth: 0 })
    expect(learned.upiIds).toBe('ASHAR M')

    const [r4] = await ingestSms(payload, String(user.id), [
      { sender: F, body: upi('200.00', 'ASHAR M', '627100000204', '02Oct26 11:00'), receivedAt: '2026-10-02T05:30:30Z' },
    ])
    const s4 = await payload.findByID({ collection: 'captured-sms', id: r4.id!, depth: 0 })
    expect((s4.suggestion as any).person).toBe(ashar.id)
  })

  it('only remembers payees that look like the person', () => {
    expect(payeeBelongsTo('x123@ybl', 'Anyone')).toBe(true)
    expect(payeeBelongsTo('ELIZEBETH S', 'Elizebeth Shaji')).toBe(true)
    expect(payeeBelongsTo('HOTEL AKSHAY', 'Ashar Mathew')).toBe(false)
    expect(payeeBelongsTo('AB', 'Ab Cd')).toBe(false)
  })

  it('auto-confirms a merchant confirmed the same way 3 times, and undo stops it', async () => {
    await payload.update({
      collection: 'user-settings',
      where: { user: { equals: user.id } },
      data: { smsAutoConfirm: true, smsAutoConfirmMaxAmount: 500 } as any,
    })
    const tea = (n: number, amt = '20.00') => ({
      sender: F,
      body: upi(amt, 'TEA CORNER', `62710000030${n}`, `0${n}Oct26 16:00`),
      receivedAt: `2026-10-0${n}T10:30:30Z`,
    })
    const [first] = await ingestSms(payload, String(user.id), [tea(1)])
    await confirmCapturedSms(payload, user, first.id!, { title: 'Tea', category: expenseCat })
    for (const n of [2, 3]) {
      const [r] = await ingestSms(payload, String(user.id), [tea(n)])
      expect(r.status).toBe('pending')
      await confirmCapturedSms(payload, user, r.id!)
    }

    const [big] = await ingestSms(payload, String(user.id), [tea(4, '900.00')])
    expect(big.status).toBe('pending') // over the limit

    const [r5] = await ingestSms(payload, String(user.id), [tea(5)])
    expect(r5).toMatchObject({ status: 'auto', summary: { title: 'Tea', amount: '20.00' } })
    const tx = await payload.findByID({ collection: 'transactions', id: r5.transaction!, depth: 0 })
    expect(tx).toMatchObject({ title: 'Tea', category: expenseCat, source: 'sms' })

    await undoAutoConfirmedSms(payload, user, r5.id!)
    const undone = await payload.findByID({ collection: 'captured-sms', id: r5.id!, depth: 0 })
    expect(undone).toMatchObject({ status: 'pending', autoConfirmed: false, autoUndone: true, transaction: null })
    await expect(payload.findByID({ collection: 'transactions', id: r5.transaction!, depth: 0 })).rejects.toThrow()

    const [r6] = await ingestSms(payload, String(user.id), [tea(6)])
    expect(r6.status).toBe('pending')
    await expect(undoAutoConfirmedSms(payload, user, r6.id!)).rejects.toThrow(/not added automatically/)
  })
})
