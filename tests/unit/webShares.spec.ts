import { describe, it, expect } from 'vitest'
import { evenShares, myShare } from '@/lib/web/shares'

describe('split with people', () => {
  it('splits evenly including me, to the paisa', () => {
    // ₹100 among me + 2 friends: friends get 33.33 each, I keep 33.34
    expect(evenShares(100, 2)).toEqual(['33.33', '33.33'])
    expect(myShare(100, ['33.33', '33.33'])).toBe('33.34')
  })
  it('handles one friend and odd paise', () => {
    expect(evenShares(0.05, 1)).toEqual(['0.02'])
    expect(evenShares(1200, 1)).toEqual(['600.00'])
  })
  it('no friends → no shares', () => {
    expect(evenShares(50, 0)).toEqual([])
    expect(myShare(50, [])).toBe('50.00')
  })
})
