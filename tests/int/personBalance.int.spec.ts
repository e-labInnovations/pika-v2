import { describe, it, expect } from 'vitest'
import { sumPersonBalance } from '@/utilities/calculatePersonBalance'

const tx = (id: string, type: string, amount: string, date = '2026-01-01T00:00:00.000Z') => ({ id, type, amount, date })

describe('sumPersonBalance', () => {
  it('income from a person means you owe them; expense on them means they owe you', () => {
    const r = sumPersonBalance([tx('a', 'income', '100'), tx('b', 'expense', '30')])
    expect(r.balance).toBe(70)
    expect(r.totalSummary).toEqual({ totalSpent: 30, totalReceived: 100 })
  })

  it('a loan and its repayment net to zero', () => {
    expect(sumPersonBalance([tx('lent', 'expense', '1000'), tx('back', 'income', '1000')]).balance).toBe(0)
  })

  it('a split payback settles their share: counted as received, not as owed', () => {
    // Paid 46 for coffee (no person on it); Rony paid back his 17.
    const r = sumPersonBalance([tx('payback', 'income', '17')], new Set(['payback']))
    expect(r.balance).toBe(0)
    expect(r.totalSummary.totalReceived).toBe(17)
  })

  it('an unpaid loan stays owed while a split payback from the same person is ignored', () => {
    // Office chechi: borrowed 500 (never repaid) and paid back 219 for food ordered for her.
    const r = sumPersonBalance([tx('loan', 'expense', '500'), tx('food', 'income', '219')], new Set(['food']))
    expect(r.balance).toBe(-500)
  })

  it('tracks the latest transaction date', () => {
    const r = sumPersonBalance([tx('a', 'income', '1', '2026-01-01T00:00:00.000Z'), tx('b', 'expense', '1', '2026-03-01T00:00:00.000Z')])
    expect(r.lastTransactionAt).toBe('2026-03-01T00:00:00.000Z')
  })
})
