import type { Payload } from 'payload'
import type { ParsedSms } from './sms/parse'

export type BalanceCheck = {
  account: string
  /** Balance the bank reported in its latest SMS. */
  bankBalance: number
  /** Pika's balance at that moment, counting pending SMS as if confirmed. */
  pikaBalance: number
  /** bankBalance - pikaBalance; positive means Pika is missing income (or has an extra expense). */
  difference: number
  matched: boolean
  /** When the latest SMS balance was reported. */
  asOf: string
  sms: string
  /** Last SMS balance that agreed with Pika; the missing transaction is after this. */
  lastMatchedAt: string | null
  /** First SMS balance after lastMatchedAt that disagreed. */
  firstOffAt: string | null
  /** Pending SMS on this account (already counted in pikaBalance). */
  pending: number
}

type Movement = { at: number; delta: number }
type Checkpoint = { at: number; balance: number; sms: string }

// SMS times are to the minute; a transaction in the same minute can land either side of it.
const WINDOW_MS = 60_000
const EPSILON = 0.005
const MAX_CHECKPOINTS = 200

const round2 = (n: number) => Math.round(n * 100) / 100

const MAX_SUBSET = 10

/**
 * Balances the account may have had at a checkpoint: the balance before the window plus
 * any subset of the movements inside it (their order within a minute is unknown).
 * The last value is the balance after the whole window.
 */
function candidateBalances(movements: Movement[], from: number, to: number): number[] {
  let before = 0
  const inside: number[] = []
  for (const m of movements) {
    if (m.at < from) before += m.delta
    else if (m.at <= to) inside.push(m.delta)
  }
  const all = before + inside.reduce((a, b) => a + b, 0)
  if (inside.length > MAX_SUBSET) return [before, all]
  const values: number[] = []
  for (let mask = 0; mask < 1 << inside.length; mask++) {
    let v = before
    for (let i = 0; i < inside.length; i++) if (mask & (1 << i)) v += inside[i]
    values.push(v)
  }
  values.push(all)
  return values
}

export function compareCheckpoints(movements: Movement[], checkpoints: Checkpoint[]) {
  checkpoints.sort((a, b) => b.at - a.at)

  const evaluate = (c: Checkpoint) => {
    const values = candidateBalances(movements, c.at - WINDOW_MS, c.at + WINDOW_MS)
    const hit = values.find((v) => Math.abs(v - c.balance) < EPSILON)
    return hit !== undefined ? { matched: true, pika: hit } : { matched: false, pika: values[values.length - 1] }
  }

  const latest = evaluate(checkpoints[0])
  let lastMatchedAt: number | null = null
  let firstOffAt: number | null = null
  if (latest.matched) {
    lastMatchedAt = checkpoints[0].at
  } else {
    firstOffAt = checkpoints[0].at
    for (const c of checkpoints.slice(1)) {
      if (evaluate(c).matched) {
        lastMatchedAt = c.at
        break
      }
      firstOffAt = c.at
    }
  }
  return { latest, lastMatchedAt, firstOffAt }
}

/**
 * Compares each account's latest bank-reported balance (from captured SMS) with Pika's
 * balance at that time. Accounts without any SMS balance are left out.
 */
export async function checkBalances(payload: Payload, userId: string): Promise<BalanceCheck[]> {
  const sms = await payload.find({
    collection: 'captured-sms',
    where: {
      and: [
        { user: { equals: userId } },
        { account: { exists: true } },
        { status: { not_equals: 'unparsed' } },
      ],
    },
    sort: '-receivedAt',
    limit: 1000,
    depth: 0,
    select: { status: true, parsed: true, account: true, receivedAt: true },
  })

  type Row = { id: string; status: string; parsed: ParsedSms; at: number }
  const byAccount = new Map<string, Row[]>()
  for (const d of sms.docs) {
    const parsed = d.parsed as ParsedSms | null
    if (!parsed || !d.account) continue
    const at = Date.parse(parsed.occurredAt ?? (d.receivedAt as string))
    const account = String(d.account)
    if (!byAccount.has(account)) byAccount.set(account, [])
    byAccount.get(account)!.push({ id: String(d.id), status: d.status as string, parsed, at })
  }

  const results: BalanceCheck[] = []
  for (const [account, rows] of byAccount) {
    const checkpoints: Checkpoint[] = rows
      .filter((r) => r.parsed.balance != null)
      .slice(0, MAX_CHECKPOINTS)
      .map((r) => ({ at: r.at, balance: parseFloat(r.parsed.balance!), sms: r.id }))
    if (!checkpoints.length) continue

    const [outgoing, incoming] = await Promise.all([
      payload.find({
        collection: 'transactions',
        where: { account: { equals: account } },
        pagination: false,
        depth: 0,
        select: { type: true, amount: true, date: true },
      }),
      payload.find({
        collection: 'transactions',
        where: { and: [{ type: { equals: 'transfer' } }, { toAccount: { equals: account } }] },
        pagination: false,
        depth: 0,
        select: { amount: true, date: true },
      }),
    ])

    const movements: Movement[] = []
    for (const tx of outgoing.docs) {
      const amount = parseFloat(tx.amount as string) || 0
      movements.push({ at: Date.parse(tx.date as string), delta: tx.type === 'income' ? amount : -amount })
    }
    for (const tx of incoming.docs) {
      movements.push({ at: Date.parse(tx.date as string), delta: parseFloat(tx.amount as string) || 0 })
    }
    const pending = rows.filter((r) => r.status === 'pending')
    for (const r of pending) {
      const amount = parseFloat(r.parsed.amount) || 0
      movements.push({ at: r.at, delta: r.parsed.type === 'income' ? amount : -amount })
    }

    const { latest, lastMatchedAt, firstOffAt } = compareCheckpoints(movements, checkpoints)
    const top = checkpoints[0]
    results.push({
      account,
      bankBalance: top.balance,
      pikaBalance: round2(latest.pika),
      difference: round2(top.balance - latest.pika),
      matched: latest.matched,
      asOf: new Date(top.at).toISOString(),
      sms: top.sms,
      lastMatchedAt: lastMatchedAt != null ? new Date(lastMatchedAt).toISOString() : null,
      firstOffAt: firstOffAt != null ? new Date(firstOffAt).toISOString() : null,
      pending: pending.length,
    })
  }
  return results
}
