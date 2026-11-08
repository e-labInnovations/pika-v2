import { describe, it, expect } from 'vitest'
import { parseTxParams, toSearch, toWhere, SORT_FIELD, PAGE_SIZE } from '@/lib/web/filters'

const ctx = (childrenOf: (id: string) => string[] = () => []) => ({ userId: 'u', timeZone: 'Asia/Kolkata', childrenOf })

describe('web transaction filters', () => {
  it('round-trips params', () => {
    const q = parseTxParams({ q: 'rent', types: 'expense', tags: 'a,b', from: '2026-11-01', to: '2026-11-30', min: '100', sort: 'highest', page: '2' })
    expect(q).toMatchObject({ q: 'rent', types: ['expense'], tags: ['a', 'b'], min: 100, sort: 'highest', page: 2 })
    expect(parseTxParams(Object.fromEntries(new URLSearchParams(toSearch(q))))).toEqual(q)
  })

  it('drops garbage params', () => {
    expect(parseTxParams({ min: 'abc', from: '2026-13-40', page: '-3', types: 'nope', sort: 'x' })).toEqual({
      types: [],
      categories: [],
      tags: [],
      people: [],
      accounts: [],
      sort: 'newest',
      page: 1,
    })
  })

  it('toSearch omits defaults and empties', () => {
    expect(toSearch(parseTxParams({}))).toBe('')
    expect(toSearch({ tags: ['x'] })).toBe('?tags=x')
  })

  it('a date range uses local-day bounds', () => {
    const w = JSON.stringify(toWhere(parseTxParams({ from: '2026-11-01', to: '2026-11-01' }), ctx()))
    expect(w).toContain('2026-10-31T18:30:00.000Z')
    expect(w).toContain('2026-11-01T18:30:00.000Z')
  })

  it('a parent category expands to its children; a numeric search also matches the amount', () => {
    const w = JSON.stringify(toWhere(parseTxParams({ categories: 'p', q: '250' }), ctx((id) => (id === 'p' ? ['c1', 'c2'] : []))))
    expect(w).toContain('"p","c1","c2"')
    expect(w).toContain('"amountValue":{"equals":250}')
  })

  it('always scopes to the user; people match shares too', () => {
    const w = JSON.stringify(toWhere(parseTxParams({ people: 'x' }), ctx()))
    expect(w).toContain('"user":{"equals":"u"}')
    expect(w).toContain('"shares.person":{"in":["x"]}')
  })

  it('exposes sort fields and page size', () => {
    expect(SORT_FIELD.highest).toBe('-amountValue')
    expect(PAGE_SIZE).toBe(50)
  })

  it('ignores absurd page numbers', () => {
    expect(parseTxParams({ page: 'Infinity' }).page).toBe(1)
    expect(parseTxParams({ page: '1e20' }).page).toBe(1)
    expect(parseTxParams({ page: '12' }).page).toBe(12)
  })
})
