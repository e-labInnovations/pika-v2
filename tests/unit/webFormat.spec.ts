import { describe, it, expect } from 'vitest'
import { formatMoney, formatSigned, formatLocalDate, formatLocalDateTime, localDay, zone } from '@/lib/web/format'

describe('web formatting', () => {
  it('formats money in INR with Indian grouping', () => {
    expect(formatMoney(1234.5)).toBe('₹1,234.50')
    expect(formatMoney(1234567)).toBe('₹12,34,567.00')
  })
  it('signs by type', () => {
    expect(formatSigned(50, 'expense')).toBe('-₹50.00')
    expect(formatSigned(50, 'income')).toBe('+₹50.00')
    expect(formatSigned(50, 'transfer')).toBe('₹50.00')
  })
  it('formats local dates, reading UTC as India', () => {
    expect(formatLocalDateTime('2026-11-08T09:00:00Z', 'UTC')).toBe('8 Nov 2026, 14:30')
    expect(formatLocalDate('2026-10-31T19:00:00Z', 'Asia/Kolkata')).toBe('1 Nov 2026')
    expect(zone('')).toBe('Asia/Kolkata')
    expect(zone('Europe/London')).toBe('Europe/London')
  })
  it('gives the local calendar day of an instant', () => {
    expect(localDay('2026-10-31T18:30:00Z', 'Asia/Kolkata')).toBe('2026-11-01')
    expect(localDay('2026-10-31T18:29:00Z', 'Asia/Kolkata')).toBe('2026-10-31')
  })
})
