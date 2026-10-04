import { describe, it, expect } from 'vitest'
import { narrowLists } from '@/utilities/ai/narrow-context'
import { stripTags } from '@/utilities/ai/tagged-entities'

const cat = (id: string, parent?: string) => ({ id, name: id, parent: parent ?? null }) as any
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}` }))

describe('narrowLists', () => {
  const categories = [cat('food'), cat('travel'), ...many('c', 30).map((c) => cat(c.id, 'food'))]
  const lists = { categories, tags: many('t', 20), people: many('p', 20) }
  const relevant = { categories: new Set(['c1', 'c2']), tags: new Set(['t3']), people: new Set(['p4']) }

  it('keeps relevant children and every parent, drops the rest', () => {
    const n = narrowLists(lists, relevant)
    expect(n.categories.map((c) => c.id)).toEqual(['food', 'travel', 'c1', 'c2'])
    expect(n.tags.map((t) => t.id)).toEqual(['t3'])
    expect(n.people.map((p) => p.id)).toEqual(['p4'])
  })

  it('sends short lists whole', () => {
    const n = narrowLists({ categories: categories.slice(0, 10), tags: many('t', 5), people: many('p', 3) }, relevant)
    expect(n.categories).toHaveLength(10)
    expect(n.tags).toHaveLength(5)
    expect(n.people).toHaveLength(3)
  })
})

it('stripTags leaves just the names', () => {
  expect(stripTags('lunch with @[Rony](person:11111111-2222-3333-4444-555555555555) split')).toBe('lunch with Rony split')
})
