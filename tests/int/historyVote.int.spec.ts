import { describe, it, expect } from 'vitest'
import { isConfidentPrediction, voteOnNeighbours } from '@/utilities/ai/user-history'

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
