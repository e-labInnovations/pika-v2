import { describe, it, expect } from 'vitest'
import { toPrefill } from '@/lib/web/prefill'

describe('AI result → add form', () => {
  it('maps resolved docs to ids and the date to local input time', () => {
    const p = toPrefill(
      {
        title: 'Lunch at Paragon',
        amount: 250,
        type: 'expense',
        date: '2026-11-08T07:45:00.000Z',
        category: { id: 'c1', name: 'Lunch' },
        account: { id: 'a1' },
        toAccount: null,
        person: { id: 'p1' },
        tags: [{ id: 't1' }, 't2'],
        shares: [{ person: { id: 'p2' }, amount: '100' }],
        note: 'with team',
      },
      'Asia/Kolkata',
    )
    expect(p).toEqual({
      type: 'expense',
      title: 'Lunch at Paragon',
      amount: '250',
      date: '2026-11-08T13:15',
      category: 'c1',
      account: 'a1',
      toAccount: null,
      person: 'p1',
      tags: ['t1', 't2'],
      shares: [{ person: 'p2', amount: '100.00' }],
      note: 'with team',
    })
  })

  it('tolerates gaps: unknown type → expense, bad date → none, missing fields empty', () => {
    expect(toPrefill({ type: 'weird', date: 'nope' }, 'Asia/Kolkata')).toEqual({
      type: 'expense',
      title: '',
      amount: '',
      date: null,
      category: null,
      account: null,
      toAccount: null,
      person: null,
      tags: [],
      shares: [],
      note: '',
    })
  })
})
