import { describe, it, expect } from 'vitest'
import { isConfidentPrediction, pickPerson, voteOnNeighbours } from '@/utilities/ai/user-history'

const n = (categoryId: string, sim: number, tagIds: string[] = [], personId: string | null = null) => ({
  categoryId,
  tagIds,
  personId,
  sim,
})

describe('voteOnNeighbours', () => {
  it('picks the category with the most similarity weight among the top K', () => {
    const v = voteOnNeighbours([n('food', 0.9), n('food', 0.8), n('travel', 0.95), n('travel', 0.1)], 3)!
    expect(v.categoryId).toBe('food')
    expect(v.support).toBe(2)
    expect(v.score).toBeCloseTo(1.7 / 2.65)
    expect(v.topSim).toBe(0.95)
  })

  it('suggests tags most of the winning neighbours carry', () => {
    const v = voteOnNeighbours([n('food', 0.9, ['tea']), n('food', 0.8, ['tea']), n('food', 0.3, ['office'])])!
    expect(v.tags).toEqual(['tea'])
  })

  it('ignores neighbours with no similarity', () => {
    expect(voteOnNeighbours([n('food', 0), n('food', -0.2)])).toBeNull()
  })
})

describe('isConfidentPrediction', () => {
  it('needs both a majority and a close neighbour', () => {
    expect(isConfidentPrediction({ score: 0.9, topSim: 0.9 })).toBe(true)
    expect(isConfidentPrediction({ score: 0.9, topSim: 0.5 })).toBe(false)
    expect(isConfidentPrediction({ score: 0.4, topSim: 0.95 })).toBe(false)
  })
})

describe('pickPerson', () => {
  const people = [
    { id: 'rony', name: 'Rony' },
    { id: 'aama', name: 'Aama' },
    { id: 'shamil', name: 'Shamil C' },
  ]

  it('suggests the person most close neighbours share', () => {
    const v = voteOnNeighbours([n('lent', 0.9, [], 'rony'), n('split', 0.85, [], 'rony'), n('food', 0.3, [], 'aama')])!
    expect(v.person).toEqual({ id: 'rony', share: 1 })
    expect(pickPerson('Drop share', v, people)).toBe('rony')
  })

  it('stays out when close neighbours are mixed or none are close', () => {
    expect(pickPerson('Lent', voteOnNeighbours([n('lent', 0.9, [], 'rony'), n('lent', 0.85, [], 'aama')]), people)).toBeNull()
    expect(pickPerson('Lent', voteOnNeighbours([n('lent', 0.6, [], 'rony'), n('lent', 0.55, [], 'rony')]), people)).toBeNull()
  })

  it('drops the vote when the title names someone else, and never suggests from a name alone', () => {
    const v = voteOnNeighbours([n('lent', 0.7, [], 'rony'), n('lent', 0.7, [], 'rony')])
    expect(pickPerson('Lent to Aama', v, people)).toBeNull()
    expect(pickPerson('Rony and Aama dinner', v, people)).toBe('rony')
    expect(pickPerson('Payment to Shamil', null, people)).toBeNull()
  })
})
