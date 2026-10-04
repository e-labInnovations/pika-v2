import { describe, it, expect } from 'vitest'
import { compareCheckpoints } from '@/utilities/balanceCheck'

const t = (min: number) => Date.UTC(2026, 9, 1, 4, 0) + min * 60_000

describe('compareCheckpoints', () => {
  const base = [
    { at: t(0), delta: 1000 },
    { at: t(10), delta: -45 },
    { at: t(20), delta: -100 },
  ]

  it('matches when the bank balance equals Pika at that time', () => {
    const r = compareCheckpoints([...base], [
      { at: t(10), balance: 955, sms: 'a' },
      { at: t(20), balance: 855, sms: 'b' },
    ])
    expect(r.latest).toEqual({ matched: true, pika: 855 })
    expect(r.lastMatchedAt).toBe(t(20))
    expect(r.firstOffAt).toBeNull()
  })

  it('tolerates two transactions in the same minute', () => {
    const r = compareCheckpoints(
      [...base, { at: t(20), delta: -5 }],
      [{ at: t(20), balance: 950, sms: 'a' }],
    )
    expect(r.latest.matched).toBe(true)
  })

  it('finds the gap: last match and first mismatch', () => {
    // A 30 expense at t(15) is missing from Pika.
    const r = compareCheckpoints([...base, { at: t(30), delta: -10 }], [
      { at: t(10), balance: 955, sms: 'a' },
      { at: t(20), balance: 825, sms: 'b' },
      { at: t(30), balance: 815, sms: 'c' },
    ])
    expect(r.latest).toEqual({ matched: false, pika: 845 })
    expect(r.lastMatchedAt).toBe(t(10))
    expect(r.firstOffAt).toBe(t(20))
  })

  it('ignores transactions after the SMS', () => {
    const r = compareCheckpoints([...base, { at: t(60), delta: -500 }], [{ at: t(20), balance: 855, sms: 'a' }])
    expect(r.latest.matched).toBe(true)
  })
})
