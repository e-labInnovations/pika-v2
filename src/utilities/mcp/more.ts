import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { calculateAccountBalance } from '../calculateAccountBalance'
import { calculateDashboard } from '../calculateDashboard'
import { calculatePersonBalance } from '../calculatePersonBalance'
import { budgetsOverview } from '../budgets'
import { calculateInsights } from '../insights'
import { confirmCapturedSms, dismissCapturedSms, type ConfirmOverrides } from '../sms/confirm'
import { splitTransaction, type SmsPart } from '../sms/split'
import { loadContext, type Ctx } from './context'
import { makeResolver } from './resolve'
import { formatLocal, zoneOf } from './time'

const r2 = (n: number) => Math.round(n * 100) / 100

/** This month at a glance: balance, income/expenses, insights and budgets. */
export async function getOverview(payload: Payload, user: User) {
  const ctx = await loadContext(payload, user)
  const tz = zoneOf(ctx.timezone)
  const [dashboard, insights, budgets] = await Promise.all([
    calculateDashboard(payload, String(user.id), tz),
    calculateInsights(payload, String(user.id), tz),
    budgetsOverview(payload, String(user.id), tz),
  ])
  return {
    now: formatLocal(new Date(), tz),
    currency: ctx.currency,
    dashboard,
    insights: insights.map(({ title, message, kind }) => ({ kind, title, message })),
    budgets: budgets.filter((b) => !b.archived).map((b) => ({ category: b.category.name, limit: b.amount, spent: b.spent, left: b.left, percent: b.percent, status: b.status })),
  }
}

/** Account balances, and people with money outstanding either way. */
export async function getBalances(payload: Payload, user: User) {
  const ctx = await loadContext(payload, user)
  const accounts = (
    await Promise.all(
      ctx.accounts.map(async (a) => ({ name: a.name, id: a.id, archived: a.archived, balance: r2((await calculateAccountBalance(payload, a.id)).balance) })),
    )
  )
    // An archived account is listed only while money is left in it.
    .filter((a) => !a.archived || Math.abs(a.balance) >= 0.01)
  const people = (
    await Promise.all(
      ctx.people.map(async (p) => {
        const b = await calculatePersonBalance(payload, p.id)
        return { name: p.name, id: p.id, balance: r2(b.balance), open_shares: b.openShares.length }
      }),
    )
  )
    .filter((p) => Math.abs(p.balance) >= 0.01)
    .map(({ balance, ...p }) => (balance < 0 ? { ...p, owes_you: -balance } : { ...p, you_owe: balance }))
  return { currency: ctx.currency, accounts, people }
}

type PartIn = { title?: string; amount: number | string; category: string; tags?: string[]; person?: string | null }

/** Parts given by name → SmsPart with ids; errors listed per part. */
function resolveParts(ctx: Ctx, parts: PartIn[], type: 'income' | 'expense'): { parts: SmsPart[]; errors: string[] } {
  const r = makeResolver(ctx)
  const errors: string[] = []
  const out: SmsPart[] = []
  parts.forEach((p, i) => {
    const cat = r.category(p.category, type)
    const amount = Number(p.amount)
    if ('error' in cat) errors.push(`part ${i + 1}: ${cat.error}`)
    if (!(amount > 0)) errors.push(`part ${i + 1}: amount must be positive.`)
    const tags: string[] = []
    for (const t of p.tags ?? []) {
      const tr = r.tag(t)
      if ('error' in tr) errors.push(`part ${i + 1}: ${tr.error}`)
      else tags.push(tr.id)
    }
    let person: string | null = null
    if (p.person) {
      const pr = r.person(p.person)
      if ('error' in pr) errors.push(`part ${i + 1}: ${pr.error}`)
      else person = pr.id
    }
    if ('id' in cat) out.push({ title: (p.title ?? '').trim() || `Part ${i + 1}`, amount: amount.toFixed(2), category: cat.id, tags, person })
  })
  return { parts: out, errors }
}

export type SmsQueueArgs =
  | { action: 'list'; limit?: number }
  | {
      action: 'confirm'
      id: string
      title?: string
      category?: string
      account?: string
      tags?: string[]
      person?: string | null
      note?: string
    }
  | { action: 'split'; id: string; parts: PartIn[] }
  | { action: 'dismiss'; id: string }

/** Bank SMS waiting for review: list them, confirm (optionally changing fields by name), split, dismiss. */
export async function smsQueue(payload: Payload, user: User, args: SmsQueueArgs) {
  const ctx = await loadContext(payload, user)
  const tz = zoneOf(ctx.timezone)
  const r = makeResolver(ctx)
  const name = (list: { id: string; name: string }[], id: unknown) => list.find((x) => x.id === String(id))?.name ?? null

  if (args.action === 'list') {
    const res = await payload.find({
      collection: 'captured-sms',
      where: { status: { equals: 'pending' } },
      sort: '-receivedAt',
      limit: Math.min(Math.max(Number(args.limit) || 20, 1), 50),
      depth: 0,
      user,
      overrideAccess: false,
    })
    return {
      pending: res.totalDocs,
      sms: res.docs.map((d) => {
        const p = (d.parsed ?? {}) as { amount?: string; type?: string; merchant?: string; occurredAt?: string }
        const s = (d.suggestion ?? {}) as { title?: string; category?: string; tags?: string[]; person?: string; parts?: SmsPart[] }
        return {
          id: String(d.id),
          when: formatLocal(String(p.occurredAt ?? d.receivedAt), tz),
          amount: Number(p.amount ?? 0),
          type: p.type,
          payee: p.merchant ?? null,
          account: name(ctx.accounts, d.account),
          text: d.body,
          suggested: {
            title: s.title ?? null,
            category: name(ctx.categories, s.category),
            tags: (s.tags ?? []).map((t) => name(ctx.tags, t)).filter(Boolean),
            person: name(ctx.people, s.person),
            ...(s.parts?.length
              ? { split: s.parts.map((p) => ({ title: p.title, amount: Number(p.amount), category: name(ctx.categories, p.category) })) }
              : {}),
          },
        }
      }),
    }
  }

  if (args.action === 'dismiss') {
    await dismissCapturedSms(payload, user, args.id)
    return { id: args.id, status: 'dismissed' }
  }

  const sms = await payload.findByID({ collection: 'captured-sms', id: args.id, depth: 0, user, overrideAccess: false })
  const type = ((sms.parsed as { type?: string } | null)?.type === 'income' ? 'income' : 'expense') as 'income' | 'expense'

  if (args.action === 'split') {
    const { parts, errors } = resolveParts(ctx, args.parts ?? [], type)
    if (errors.length) return { id: args.id, status: 'error', errors }
    const res = await confirmCapturedSms(payload, user, args.id, { parts })
    return { id: args.id, status: 'confirmed', transaction: res.transaction, parts: parts.length }
  }

  // confirm
  const overrides: ConfirmOverrides = { parts: [] }
  const errors: string[] = []
  if (args.title) overrides.title = args.title
  if (args.note) overrides.note = args.note
  if (args.category) {
    const c = r.category(args.category, type)
    if ('error' in c) errors.push(c.error)
    else overrides.category = c.id
  }
  if (args.account) {
    const a = r.account(args.account)
    if ('error' in a) errors.push(a.error)
    else overrides.account = a.id
  }
  if (args.person !== undefined) {
    if (args.person === null) overrides.person = null
    else {
      const p = r.person(args.person)
      if ('error' in p) errors.push(p.error)
      else overrides.person = p.id
    }
  }
  if (args.tags) {
    overrides.tags = []
    for (const t of args.tags) {
      const tr = r.tag(t)
      if ('error' in tr) errors.push(tr.error)
      else overrides.tags.push(tr.id)
    }
  }
  if (errors.length) return { id: args.id, status: 'error', errors }
  // Keep a suggested split unless the caller changed the single transaction.
  const suggestedSplit = ((sms.suggestion as { parts?: SmsPart[] } | null)?.parts ?? []).length > 0
  const changed = Object.keys(overrides).some((k) => k !== 'parts')
  if (suggestedSplit && !changed) delete overrides.parts
  const res = await confirmCapturedSms(payload, user, args.id, overrides)
  return { id: args.id, status: 'confirmed', transaction: res.transaction }
}

/** Split a saved transaction into parts given by name (it stays as the first part). */
export async function splitTransactionByName(payload: Payload, user: User, args: { id: string; parts: PartIn[] }) {
  const ctx = await loadContext(payload, user)
  const tx = await payload.findByID({ collection: 'transactions', id: args.id, depth: 0, user, overrideAccess: false })
  const { parts, errors } = resolveParts(ctx, args.parts ?? [], tx.type === 'income' ? 'income' : 'expense')
  if (errors.length) return { id: args.id, status: 'error', errors }
  const res = await splitTransaction(payload, user, args.id, parts)
  return { id: args.id, status: 'split', transactions: res.transactions }
}
