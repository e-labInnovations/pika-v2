import { describe, it, expect } from 'vitest'
import { describe as describeParticulars, parseFederalStatement } from '@/utilities/statements/federal'
import { matchRows } from '@/utilities/statements/import'

const page1 = `The Federal Bank Ltd. Corporate Office: Federal Towers, Market Rd, Periyar Nagar, Aluva, Kerala, 683101,
Ph:0484 2630996 Website:www.federalbank.co.in Page 1 of 2
Account Number : 11112222333344
Statement of Account for the period 2026-09-01 to 2026-09-30
Opening Balance 1000.00 Cr
01-SEP-2026 01-SEP-2026 UPIOUT/600000000001
/shop1@ptys/Coffee/5812
TFR S1 45.00 955.00 Cr
02-SEP-2026 02-SEP-2026 UPI IN/600000000002/frie.
nd@okaxis/UPI/0000`
const page2 = `The Federal Bank Ltd. Corporate Office: Federal Towers, Market Rd, Periyar Nagar, Aluva, Kerala, 683101,
Ph:0484 2630996 Website:www.federalbank.co.in Page 2 of 2
TFR S2 100.00 1055.00 Cr
29-SEP-2026 28-SEP-2026 SBINT:29-06-2026 to 28-09-2026
[11112222333344]
SBINT S3 12.00 1067.00 Cr
30-SEP-2026 30-SEP-2026 NFT/ACME CORP
/BOFA0001/BANK OF AM
TFR S4 5,000.00 6,067.00 Cr
GRAND TOTAL 45.00 5112.00`

describe('Federal statement parser', () => {
  const s = parseFederalStatement([page1, page2])

  it('reads header, rows across pages and direction from the balance', () => {
    expect(s).toMatchObject({ accountNumber: '11112222333344', from: '2026-09-01', to: '2026-09-30', openingBalance: 1000 })
    expect(s.rows.map((r) => [r.date, r.type, r.amount])).toEqual([
      ['2026-09-01', 'expense', '45.00'],
      ['2026-09-02', 'income', '100.00'],
      ['2026-09-29', 'income', '12.00'],
      ['2026-09-30', 'income', '5000.00'],
    ])
  })

  it('pulls payee, reference and a title hint from particulars', () => {
    expect(s.rows[0]).toMatchObject({ ref: '600000000001', payee: 'shop1@ptys', hint: 'Coffee' })
    expect(s.rows[1]).toMatchObject({ ref: '600000000002', payee: 'frie.nd@okaxis', hint: null })
    expect(s.rows[2].hint).toBe('Savings account interest')
    expect(s.rows[3]).toMatchObject({ payee: 'ACME CORP', hint: 'NEFT from Acme Corp' })
    expect(describeParticulars('MCDRefund02092026WWWAMAZON').hint).toBe('Card refund')
  })
})

describe('matching statement rows to transactions', () => {
  const s = parseFederalStatement([page1, page2])
  const tx = (id: string, delta: number, day: string, externalRef: string | null = null) =>
    ({ id, title: id, amount: Math.abs(delta), delta, day, externalRef, note: '' })

  it('uses the reference first, then amount and day, then a day either side, each once', () => {
    const m = matchRows(s.rows, [
      tx('coffee', -45, '2026-09-03', '600000000001'), // wrong day, but same ref
      tx('friend', 100, '2026-09-02'),
      tx('interest', 12, '2026-09-28'), // value date
      tx('other-interest', 12, '2026-09-28'), // only one of these can match
    ])
    expect(m.map((t) => t?.id ?? null)).toEqual(['coffee', 'friend', 'interest', null])
  })

  it('never matches the opposite direction', () => {
    const m = matchRows(s.rows, [tx('refund', 45, '2026-09-01')])
    expect(m[0]).toBeNull()
  })
})
