import { describe, it, expect } from 'vitest'
import { parseSms, providerForSender, looksFinancial } from '@/utilities/sms/parse'
import { identifierTokens, resolveAccount, merchantKey } from '@/utilities/sms/ingest'

// Real message formats, made-up names and numbers.
const F = 'AD-FEDBNK-S'
const P = 'JM-Pluxee-S'
const tail = 'Not you? Call 18004251199/SMS BLOCKUPI to 98950 88888 -Federal Bank'

describe('providerForSender', () => {
  it('matches sender variants case-insensitively', () => {
    expect(providerForSender('AX-FEDBNK-T')).toBe('federal')
    expect(providerForSender('VD-Pluxee')).toBe('pluxee')
    expect(providerForSender('AT-AIRTEL')).toBeNull()
  })
})

describe('parseSms — Federal Bank', () => {
  it('UPI "sent via" (WhatsApp-style)', () => {
    expect(parseSms(F, `Rs 75.00 sent via UPI on 17-06-2026 at 18:46:50 to Annapurna.Ref:124800000001.${tail}`)).toEqual({
      provider: 'federal', kind: 'upi_debit', type: 'expense', amount: '75.00',
      occurredAt: '2026-06-17T13:16:50.000Z', merchant: 'Annapurna', ref: '124800000001', accountHints: [], balance: null,
    })
  })

  it('UPI debit to VPA', () => {
    const p = parseSms(F, 'Rs 1000.00 debited via UPI on 18-08-2025 11:16:59 to VPA leela.m@oksbi.Ref No 559600000002.Small txns?Use UPI Lite!-Federal Bank')
    expect(p).toMatchObject({ kind: 'upi_debit', amount: '1000.00', merchant: 'leela.m@oksbi', ref: '559600000002', occurredAt: '2025-08-18T05:46:59.000Z' })
  })

  it('UPI debit with account and balance', () => {
    const p = parseSms(F, 'Debited Rs 45.00 from a/c X1234 on 28Sep26 08:56 via UPI to HOTEL SAMPLE. Ref 627100000003.Bal Rs 258127.54. Not you?Call 18004251199 -Federal Bank')
    expect(p).toMatchObject({
      kind: 'upi_debit', amount: '45.00', merchant: 'HOTEL SAMPLE', ref: '627100000003',
      accountHints: ['1234'], balance: '258127.54', occurredAt: '2026-09-28T03:26:00.000Z',
    })
  })

  it('IMPS debit and credit', () => {
    expect(parseSms(F, 'Debited Rs 320000.00 from a/c X1234 on 29Jul26 12:19 via IMPS to XX588.Ref 621000000004. Bal Rs 114006.04. Not you?Call 18004251199 -Federal Bank'))
      .toMatchObject({ kind: 'imps_debit', amount: '320000.00', merchant: 'XX588' })
    expect(parseSms(F, 'Rs 8000 credited to your A/c XX1234 via IMPS on 17JUL2026 18:49:46 IMPS Ref no 619800000005 Bal:Rs 440138.80 -Federal Bank'))
      .toMatchObject({ kind: 'imps_credit', type: 'income', amount: '8000.00', ref: '619800000005', accountHints: ['1234'], occurredAt: '2026-07-17T13:19:46.000Z' })
  })

  it('transfer to another account (no time in the message)', () => {
    expect(parseSms(F, 'Your a/c no. XXXXXXXXXX1234 is debited for Rs.58518.44 on 30-09-2025 and a/c XXXXXXXX185 credited (IMPS Ref no. 527300000006) -Federal Bank'))
      .toMatchObject({ kind: 'imps_debit', amount: '58518.44', merchant: 'A/c XX185', occurredAt: null, accountHints: ['1234'] })
  })

  it('card spend and ATM withdrawal', () => {
    expect(parseSms(F, 'Rs 503 spent@ WWW AMAZON on 29MAY26 09:46 Bal Rs 299939.57 Ref 783126. Not you? Call 18004251199/ SMS NO 1234 to 9895088888 -Federal Bank'))
      .toMatchObject({ kind: 'card_spend', type: 'expense', merchant: 'WWW AMAZON', accountHints: ['1234'], ref: '783126' })
    expect(parseSms(F, 'Rs 2000 withdrawn@ SAMPLEATM on 03AUG25 17:30 Bal Rs 117222.75 Ref 521500000051. Not you? Call 18004251199/ SMS NO 1234 to 9895088888 -Federal Bank'))
      .toMatchObject({ kind: 'atm_withdrawal', type: 'transfer', amount: '2000.00', merchant: 'SAMPLEATM' })
  })

  it('FedMobile / FedNet debit and mandate execution', () => {
    expect(parseSms(F, 'Thanks for choosing FedMobile.Rs.50000 is debited from your A/c XX1234 on 30SEP2025 10:31:50. Bal:Rs.87167.25- Federal Bank'))
      .toMatchObject({ kind: 'account_debit', amount: '50000.00', accountHints: ['1234'] })
    expect(parseSms(F, 'Dear Customer, Thank you for using FEDNET.Rs.585 debited from your A/c XX1234 on 08JAN2025 14:24:44. BAL-Rs.121476.58-Federal Bank'))
      .toMatchObject({ kind: 'account_debit', amount: '585.00' })
    expect(parseSms(F, 'Dear Customer, Your mandate with ref no- abc@okaxis registered against LinkedIn for Rs 2.00 successfully executed on 23-07-2026 19:21:18. TXN Ref No -110200000007- Federal Bank'))
      .toMatchObject({ kind: 'mandate', merchant: 'LinkedIn', amount: '2.00', ref: '110200000007' })
  })

  it('ignores OTPs, promos and mandate setup', () => {
    expect(parseSms(F, '201777 is OTP for txn of INR 860.00 at uocSBIePay on 07/02/23 on card ending 5348 -Federal Bank')).toBeNull()
    expect(parseSms(F, 'Dear Customer, You have successfully created a mandate on LinkedIn for a maximum amount of Rs 1058.26 - Federal Bank')).toBeNull()
    expect(looksFinancial('Dear Customer, You have successfully created a mandate on LinkedIn for a maximum amount of Rs 1058.26')).toBe(false)
  })
})

describe('parseSms — Pluxee', () => {
  it('meal spend, including single-digit day and seconds', () => {
    expect(parseSms(P, 'Rs. 164.69 spent from Pluxee  Meal wallet, card no.xx5678 on 27-09-2026 19:05:54 at ETERNAL LIM . Avl bal Rs.20602.63. Not you call 18002106919'))
      .toMatchObject({ kind: 'meal_spend', amount: '164.69', merchant: 'ETERNAL LIM', accountHints: ['5678', 'pluxee-meal'], balance: '20602.63' })
    expect(parseSms(P, 'Rs. 123.38 spent from Pluxee Meal wallet, card no.xx5678 on 6-09-2026 20:11:8 at ETERNAL LIM . Avl bal Rs.12310.65. Not you call 18002106919'))
      .toMatchObject({ occurredAt: '2026-09-06T14:41:08.000Z' })
  })

  it('reward spend, wallet credit, gift card', () => {
    expect(parseSms(P, 'Rs. 10299.00 spent from Pluxee  Reward wallet, card no.xx9999 on 25-01-2025 21:04:6 at FLIPKARTINT . Avl bal Rs.5101.00. Not you call 18002106919'))
      .toMatchObject({ kind: 'reward_spend', accountHints: ['9999', 'pluxee-reward'] })
    expect(parseSms(P, 'Your Pluxee Card has been successfully credited with Rs.10800 towards  Meal Wallet on Fri Sep 11 2026 11:42:21. Your current Meal Wallet balance is Rs.22888.65.'))
      .toMatchObject({ kind: 'meal_credit', type: 'income', amount: '10800.00', accountHints: ['pluxee-meal'], occurredAt: '2026-09-11T06:12:21.000Z' })
    expect(parseSms(P, 'You have received a Pluxee Card worth Rs. 7000 from ACME CORP PRIVATE LIMITED.'))
      .toMatchObject({ kind: 'gift_card', type: 'income', merchant: 'ACME CORP PRIVATE LIMITED', accountHints: ['pluxee-reward'] })
  })

  it('reversal carries the original purchase time', () => {
    expect(parseSms(P, 'Your Pluxee Card xx5678 has been credited with INR 92.75 on Fri May 01 2026 12:47:11as a reversal against a previous transaction on May 01,2026 09:42:42.'))
      .toMatchObject({ kind: 'reversal', type: 'income', amount: '92.75', reversalOf: '2026-05-01T04:12:42.000Z' })
  })
})

describe('account matching', () => {
  const accounts = [
    { id: 'bank', tokens: identifierTokens('X1234') },
    { id: 'meal', tokens: identifierTokens('xx5678, pluxee-meal') },
    { id: 'reward', tokens: identifierTokens('xx9999, pluxee-reward') },
  ]
  it('matches by card/account ending or keyword', () => {
    expect(resolveAccount(accounts, ['1234'])).toBe('bank')
    expect(resolveAccount(accounts, ['5678', 'pluxee-meal'])).toBe('meal')
    expect(resolveAccount(accounts, ['pluxee-meal'])).toBe('meal')
    expect(resolveAccount(accounts, ['pluxee-reward'])).toBe('reward')
    expect(resolveAccount(accounts, ['0000'])).toBeNull()
  })
  it('normalises merchant keys', () => {
    expect(merchantKey('Hotel  sample ')).toBe('HOTEL SAMPLE')
    expect(merchantKey(null)).toBeNull()
  })
})

describe('aggregator titles', () => {
  it('delivery apps get a generic title, plain merchants keep theirs', async () => {
    const { suggest } = await import('@/utilities/sms/ingest')
    const p = parseSms('JM-Pluxee-S', 'Rs. 150.00 spent from Pluxee Meal wallet, card no.xx5678 on 04-10-2026 13:00:00 at ETERNAL LIM . Avl bal Rs.100.00. Not you call 18002106919')!
    // No payload needed: with no merchant history the default title is used.
    const fakePayload = { find: async () => ({ docs: [] }) } as any
    expect((await suggest(fakePayload, 'u1', p)).title).toBe('Zomato order')
    const q = parseSms('AD-FEDBNK-S', 'Debited Rs 45.00 from a/c X1234 on 28Sep26 08:56 via UPI to HOTEL SAMPLE. Ref 627100000003.Bal Rs 1.00. Not you?Call 18004251199 -Federal Bank')!
    expect((await suggest(fakePayload, 'u1', q)).title).toBe('Hotel Sample')
  })
})
