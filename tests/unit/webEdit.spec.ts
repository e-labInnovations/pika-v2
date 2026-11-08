import { describe, it, expect } from 'vitest'
import { formToEdit } from '@/lib/web/edit'

const original = { title: 'Lunch', note: '', amount: '12.3456', date: '2026-11-08T14:30', category: 'c1', account: 'a1', person: null, tags: ['t1'] }

describe('edit form → changes', () => {
  it('sends nothing when nothing changed', () => {
    expect(formToEdit({ title: 'Lunch', note: '', amount: '12.3456', date: '2026-11-08T14:30', category: 'c1', account: 'a1', person: '', tags: ['t1'] }, original)).toEqual({})
  })
  it('sends only the changed fields', () => {
    expect(formToEdit({ title: 'Lunch!', note: '', amount: '12.3456', date: '2026-11-08T15:00', category: 'c1', account: 'a1', person: 'p1', tags: [] }, original)).toEqual({
      title: 'Lunch!',
      date: '2026-11-08 15:00',
      person: 'p1',
      tags: [],
    })
  })
  it('treats the same amount written differently as unchanged', () => {
    expect(formToEdit({ ...original, person: '', amount: '12.34560' }, original)).toEqual({})
    expect(formToEdit({ ...original, person: '', amount: '20' }, original)).toEqual({ amount: 20 })
  })
  it('clears the person with an empty value', () => {
    expect(formToEdit({ ...original, person: '' }, { ...original, person: 'p1' })).toEqual({ person: null })
  })
})
