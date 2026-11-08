import { describe, it, expect } from 'vitest'
import { parseMonth, monthDays, shiftMonth } from '@/lib/web/month'

describe('report months', () => {
  const now = new Date('2026-10-31T19:00:00Z') // 1 Nov 00:30 IST
  it('reads YYYY-MM, else the current local month', () => {
    expect(parseMonth('2026-03', 'Asia/Kolkata', now)).toEqual({ y: 2026, m: 3 })
    expect(parseMonth('2026-13', 'Asia/Kolkata', now)).toEqual({ y: 2026, m: 11 })
    expect(parseMonth(undefined, 'Asia/Kolkata', now)).toEqual({ y: 2026, m: 11 })
  })
  it('gives first and last day', () => {
    expect(monthDays({ y: 2026, m: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthDays({ y: 2026, m: 12 })).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
  it('shifts across years', () => {
    expect(shiftMonth({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 })
    expect(shiftMonth({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 })
  })
})
