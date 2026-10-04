/**
 * Offline check of the history predictor (MiniLM k-NN vote) against real data.
 *
 *   npx tsx scripts/eval-history.ts <export-dir> [--since 2026-04-01] [--window 500]
 *
 * <export-dir> holds `transactions.json` (and optionally `categories.json`,
 * `tags.json`, `people.json` for names) as returned by
 * `GET /api/<collection>?limit=0&pagination=false&depth=0`.
 *
 * Replays transactions by date: each one is predicted from the same-type
 * transactions dated before it (the latest --window of them, default
 * HISTORY_FETCH_LIMIT as in production), then compared with what the user
 * actually chose. Date rather than createdAt, since most history was
 * bulk-imported. Nothing is written anywhere.
 */

import fs from 'node:fs'
import path from 'node:path'
import { cosine, embed } from '../src/utilities/ai/embeddings'
import {
  HISTORY_FETCH_LIMIT,
  HISTORY_MIN_SAMPLES,
  type NeighbourVote,
  pickPerson,
  voteOnNeighbours,
} from '../src/utilities/ai/user-history'

type Tx = {
  id: string
  title: string | null
  type: string
  category: string | null
  tags: string[] | null
  person: string | null
  isActive: boolean
  date: string
  deletedAt?: string | null
}

type Named = { id: string; name: string }

const args = process.argv.slice(2)
const dir = args[0]
if (!dir) {
  console.error('usage: npx tsx scripts/eval-history.ts <export-dir> [--since YYYY-MM-DD] [--window N]')
  process.exit(1)
}
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const sinceArg = option('--since')
const windowSize = Number(option('--window') ?? HISTORY_FETCH_LIMIT)

const read = <T>(file: string, fallback: T): T => {
  const p = path.join(dir, file)
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as T) : fallback
}
const names = new Map<string, string>()
for (const f of ['categories.json', 'tags.json', 'people.json']) for (const d of read<Named[]>(f, [])) names.set(d.id, d.name)
const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? id.slice(0, 8)) : '—')

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—')

type Row = {
  tx: Tx
  predicted: string
  score: number
  topSim: number
  correct: boolean
  predictedTags: string[]
  person: NeighbourVote['person']
}

async function main() {
  const all = read<Tx[]>('transactions.json', [])
    .filter((t) => t.isActive && !t.deletedAt && t.category && t.title?.trim())
    .sort((a, b) => a.date.localeCompare(b.date))

  // Embed each distinct title once.
  const vecs = new Map<string, Float32Array>()
  const titles = [...new Set(all.map((t) => t.title!.trim()))]
  process.stderr.write(`embedding ${titles.length} titles…`)
  for (const t of titles) vecs.set(t, await embed(t))
  process.stderr.write(' done\n')

  const since = sinceArg ? new Date(sinceArg).toISOString() : ''
  const rows: Row[] = []
  const byType = new Map<string, Tx[]>()
  for (const tx of all) {
    const history = byType.get(tx.type) ?? []
    const window = history.slice(-windowSize)
    if (window.length >= HISTORY_MIN_SAMPLES && tx.date >= since) {
      const q = vecs.get(tx.title!.trim())!
      const neighbours = window.map((h) => ({
        categoryId: h.category!,
        tagIds: h.tags ?? [],
        personId: h.person,
        sim: cosine(q, vecs.get(h.title!.trim())!),
      }))
      const vote = voteOnNeighbours(neighbours)
      if (vote) {
        rows.push({
          tx,
          predicted: vote.categoryId,
          score: vote.score,
          topSim: vote.topSim,
          correct: vote.categoryId === tx.category,
          predictedTags: vote.tags,
          person: vote.person,
        })
      }
    }
    history.push(tx)
    byType.set(tx.type, history)
  }

  console.log(`\n${rows.length} predictions${since ? ` since ${sinceArg}` : ''} (history window ${windowSize})\n`)

  // ── Category: accuracy vs coverage by vote share and by best similarity.
  const table = (label: string, key: (r: Row) => number, cuts: number[]) => {
    console.log(`Category by ${label}:`)
    console.log('  ≥ cut   suggested   correct')
    for (const cut of cuts) {
      const kept = rows.filter((r) => key(r) >= cut)
      const ok = kept.filter((r) => r.correct).length
      console.log(`  ${cut.toFixed(2)}    ${pct(kept.length, rows.length).padStart(6)}     ${pct(ok, kept.length).padStart(6)}`)
    }
    console.log()
  }
  table('vote share (production cut 0.50)', (r) => r.score, [0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
  table('best neighbour similarity', (r) => r.topSim, [0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95])
  // Both together: confident vote from a close neighbour.
  console.log('Category by vote share ≥ 0.5 and best similarity ≥ cut:')
  for (const cut of [0.5, 0.6, 0.7, 0.8]) {
    const kept = rows.filter((r) => r.score >= 0.5 && r.topSim >= cut)
    console.log(`  sim ${cut.toFixed(2)}: suggested ${pct(kept.length, rows.length)}, correct ${pct(kept.filter((r) => r.correct).length, kept.length)}`)
  }
  console.log()

  // ── Tags: only meaningful where the category was suggested (score ≥ 0.5).
  const tagged = rows.filter((r) => r.score >= 0.5)
  let tp = 0
  let fp = 0
  let fn = 0
  for (const r of tagged) {
    const actual = new Set(r.tx.tags ?? [])
    for (const t of r.predictedTags) actual.has(t) ? tp++ : fp++
    for (const t of actual) if (!r.predictedTags.includes(t)) fn++
  }
  console.log(`Tags (where category suggested): precision ${pct(tp, tp + fp)}, recall ${pct(tp, tp + fn)}\n`)

  // ── Person: the production rule (names in the title, then the close-neighbour vote).
  const people = read<Named[]>('people.json', []).map((p) => ({ id: p.id, name: p.name }))
  const withPerson = rows.filter((r) => r.tx.person)
  const picked = rows.map((r) => ({ r, id: pickPerson(r.tx.title!, { person: r.person }, people) })).filter((p) => p.id)
  const onPerson = picked.filter((p) => p.r.tx.person)
  const okPerson = onPerson.filter((p) => p.id === p.r.tx.person).length
  console.log(
    `Person (${withPerson.length} transactions have one): suggested ${pct(onPerson.length, withPerson.length)}, correct ${pct(okPerson, onPerson.length)}, + ${picked.length - onPerson.length} on transactions with no person`,
  )
  for (const p of onPerson.filter((x) => x.id !== x.r.tx.person).slice(0, 8)) {
    console.log(`  wrong: "${p.r.tx.title}" → ${nameOf(p.id)} (was ${nameOf(p.r.tx.person)})`)
  }
  for (const p of picked.filter((x) => !x.r.tx.person).slice(0, 8)) {
    console.log(`  extra: "${p.r.tx.title}" → ${nameOf(p.id)}`)
  }
  console.log()

  // ── Most common confident mistakes.
  const mistakes = new Map<string, { n: number; example: string }>()
  for (const r of rows.filter((x) => x.score >= 0.5 && !x.correct)) {
    const k = `${nameOf(r.tx.category)} ← predicted ${nameOf(r.predicted)}`
    const m = mistakes.get(k) ?? { n: 0, example: r.tx.title! }
    m.n++
    mistakes.set(k, m)
  }
  console.log('Top confident mistakes (actual ← predicted):')
  for (const [k, m] of [...mistakes].sort((a, b) => b[1].n - a[1].n).slice(0, 12)) {
    console.log(`  ${String(m.n).padStart(3)}  ${k}   e.g. "${m.example}"`)
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
