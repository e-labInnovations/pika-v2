import { describe, it, expect } from 'vitest'
import { applyTaggedEntities, normalizeShares, parseTaggedEntities } from '@/utilities/ai/tagged-entities'
import { renderTaggedEntities } from '@/utilities/ai/prompts'

const FED = '78e4daf7-c190-4305-8af1-520511b229e2'
const WAL = 'ec5936f0-0000-4000-8000-000000000001'
const RONY = 'aaaaaaaa-0000-4000-8000-000000000001'
const MEERA = 'aaaaaaaa-0000-4000-8000-000000000002'
const COFFEE = 'cccccccc-0000-4000-8000-000000000001'
const TAG = 'tttttttt-0000-4000-8000-000000000001'.replace(/t/g, 'b')

describe('parseTaggedEntities', () => {
  it('reads @[Name](type:id) tokens in order, once each', () => {
    const text = `Rs 45 coffee from @[Federal](account:${FED}) and @[Rony](person:${RONY}) 25 split, @[Rony](person:${RONY}) again`
    expect(parseTaggedEntities(text)).toEqual([
      { type: 'account', id: FED, name: 'Federal' },
      { type: 'person', id: RONY, name: 'Rony' },
    ])
  })

  it('ignores malformed tokens and plain @mentions', () => {
    expect(parseTaggedEntities('paid @Rony and @[Rony](person:not-a-uuid) and @[X](planet:' + RONY + ')')).toEqual([])
  })
})

describe('applyTaggedEntities', () => {
  it('a tagged account and category override the model; tags are added', () => {
    const raw = { type: 'expense', account: WAL, category: 'other', tags: ['x'] }
    const out = applyTaggedEntities(raw, [
      { type: 'account', id: FED, name: 'Federal' },
      { type: 'category', id: COFFEE, name: 'Coffee' },
      { type: 'tag', id: TAG, name: 'Kaicho' },
    ])
    expect(out).toMatchObject({ account: FED, category: COFFEE, tags: ['x', TAG] })
  })

  it('two tagged accounts on a transfer fill account then toAccount', () => {
    const out = applyTaggedEntities({ type: 'transfer' }, [
      { type: 'account', id: FED, name: 'Federal' },
      { type: 'account', id: WAL, name: 'Wallet' },
    ])
    expect(out).toMatchObject({ account: FED, toAccount: WAL })
  })

  it('leaves people to the model', () => {
    const raw = { person: '' }
    expect(applyTaggedEntities(raw, [{ type: 'person', id: RONY, name: 'Rony' }])).toEqual(raw)
  })
})

describe('normalizeShares', () => {
  const allowed = new Set([RONY, MEERA])

  it('keeps valid shares as 2-decimal strings', () => {
    expect(normalizeShares([{ person: RONY, amount: '25' }], '45', allowed)).toEqual([{ person: RONY, amount: '25.00' }])
  })

  it('drops unknown people, duplicates, and non-positive amounts', () => {
    const out = normalizeShares(
      [
        { person: 'stranger', amount: '10' },
        { person: RONY, amount: '10' },
        { person: RONY, amount: '5' },
        { person: MEERA, amount: '0' },
      ],
      '45',
      allowed,
    )
    expect(out).toEqual([{ person: RONY, amount: '10.00' }])
  })

  it('never lets shares exceed the amount', () => {
    const out = normalizeShares([{ person: RONY, amount: '30' }, { person: MEERA, amount: '30' }], '45', allowed)
    expect(out).toEqual([{ person: RONY, amount: '30.00' }])
  })

  it('handles missing or non-array input', () => {
    expect(normalizeShares(undefined, '45', allowed)).toEqual([])
    expect(normalizeShares('nope', '45', allowed)).toEqual([])
  })
})

describe('renderTaggedEntities', () => {
  it('is empty with no entities and lists ids otherwise', () => {
    expect(renderTaggedEntities([])).toBe('')
    expect(renderTaggedEntities([{ type: 'person', id: RONY, name: 'Rony' }])).toContain(`person "Rony" → id ${RONY}`)
  })
})
