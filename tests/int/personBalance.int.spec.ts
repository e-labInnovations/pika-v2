import { describe, it, expect } from 'vitest'
import { computeOpenShares, sharesFor, sumPersonBalance } from '@/utilities/calculatePersonBalance'

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

const share = (transaction: string, amount: string, date = '2026-01-01T00:00:00.000Z') => ({ transaction, title: transaction, amount, date })
const payback = (income: string, transaction: string, amount: string) => ({ income, transaction, amount })

describe('shares', () => {
  it('a share makes the person owe you until they pay it back', () => {
    // Paid 46 for coffee with a 17 share for Rony; nothing paid back yet.
    const r = sumPersonBalance([], new Set(), [share('coffee', '17')])
    expect(r.balance).toBe(-17)
    expect(r.totalSummary.totalSpent).toBe(17)
  })

  it('their linked payback cancels the share', () => {
    const r = sumPersonBalance([tx('back', 'income', '17')], new Set(), [share('coffee', '17')])
    expect(r.balance).toBe(0)
  })

  it('open shares shrink as paybacks arrive', () => {
    const open = computeOpenShares([share('coffee', '17')], [payback('back', 'coffee', '10')])
    expect(open).toEqual([{ transaction: 'coffee', title: 'coffee', date: '2026-01-01T00:00:00.000Z', share: 17, paid: 10, remaining: 7 }])
  })

  it('a fully paid share is not open', () => {
    expect(computeOpenShares([share('coffee', '17')], [payback('back', 'coffee', '17')])).toEqual([])
  })

  it('one payback linked to several shares pays the oldest first', () => {
    const open = computeOpenShares(
      [share('tea', '20', '2026-01-02T00:00:00.000Z'), share('coffee', '30', '2026-01-01T00:00:00.000Z')],
      [payback('back', 'coffee', '40'), payback('back', 'tea', '40')],
    )
    // 40 covers coffee (30) in full, then 10 of tea's 20
    expect(open).toEqual([{ transaction: 'tea', title: 'tea', date: '2026-01-02T00:00:00.000Z', share: 20, paid: 10, remaining: 10 }])
  })

  it('a payback linked to another share does not pay this one', () => {
    const open = computeOpenShares([share('coffee', '17')], [payback('back', 'lunch', '17')])
    expect(open[0].remaining).toBe(17)
  })

  it('sharesFor picks only this person, whether person is an id or a populated doc', () => {
    const rows = [{ person: 'rony', amount: '17' }, { person: { id: 'meera' }, amount: '15' }, { person: 'rony', amount: '1' }]
    expect(sharesFor(rows, 'rony')).toHaveLength(2)
    expect(sharesFor(rows, 'meera')).toHaveLength(1)
    expect(sharesFor(null, 'rony')).toEqual([])
  })
})
