import type { Payload } from 'payload'
import { localMidnight, localParts, monthKey, shift } from './localMonth'
import { budgetsOverview } from './budgets'

/**
 * What stands out this month, compared with the user's previous three full months. Plain
 * rules, no AI: category above/below usual, spending pace, an unusually large expense, a
 * first payment to a new payee. At most five, strongest first. Amounts count in full, as
 * in the other analytics.
 */
export type Insight = {
  /** Stable per month: dismissing hides it until next month. */
  key: string
  kind: 'budget' | 'category_up' | 'category_down' | 'pace' | 'large' | 'new_payee'
  tone: 'warn' | 'good' | 'info'
  title: string
  message: string
  amount: number
  /** Opens Search with these. */
  filter: { categories?: string[]; dateFrom: string; dateTo: string; query?: string }
}

const MAX = 5
const UP_RATIO = 1.3
const DOWN_RATIO = 0.6
const MIN_DIFF = 500
const PACE_RATIO = 0.15
const PACE_MIN = 1000
const LARGE_FACTOR = 3
const LARGE_MIN = 1000
const NEW_PAYEE_MIN = 1000
/** "Below usual" only near the month's end; earlier, every category is below. */
const DOWN_FROM_DAY = 25

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`
const r2 = (n: number) => Math.round(n * 100) / 100
const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export async function calculateInsights(
  payload: Payload,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<Insight[]> {
  const zone = !timeZone || timeZone === 'UTC' ? 'Asia/Kolkata' : timeZone
  const today = localParts(now, zone)
  const cur = monthKey(today.y, today.m)
  const prevKeys = [1, 2, 3].map((i) => shift(today.y, today.m, -i)).map((x) => monthKey(x.y, x.m))
  const last = shift(today.y, today.m, -1)
  const from = localMidnight(shift(today.y, today.m, -3).y, shift(today.y, today.m, -3).m, 1, zone)
  const monthStart = localMidnight(today.y, today.m, 1, zone)
  const next = shift(today.y, today.m, 1)
  const monthEnd = new Date(localMidnight(next.y, next.m, 1, zone).getTime() - 1)
  const range = { dateFrom: monthStart.toISOString(), dateTo: monthEnd.toISOString() }

  const res = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: userId } },
        { isActive: { equals: true } },
        { type: { equals: 'expense' } },
        { date: { greater_than_equal: from.toISOString() } },
        { date: { less_than_equal: now.toISOString() } },
      ],
    },
    pagination: false,
    depth: 0,
    select: { title: true, amount: true, amountValue: true, date: true, category: true },
  })

  type Row = { id: string; title: string; amount: number; month: string; day: number; category: string | null }
  const rows: Row[] = res.docs.map((t) => {
    const p = localParts(new Date(t.date as string), zone)
    return {
      id: String(t.id),
      title: String(t.title ?? ''),
      amount: typeof t.amountValue === 'number' ? t.amountValue : Number(t.amount) || 0,
      month: monthKey(p.y, p.m),
      day: p.d,
      category: idOf(t.category),
    }
  })

  const catIds = [...new Set(rows.map((r) => r.category).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (catIds.length) {
    const cats = await payload.find({ collection: 'categories', where: { id: { in: catIds } }, limit: catIds.length, depth: 0 })
    for (const c of cats.docs) names.set(String(c.id), String(c.name))
  }

  const out: (Insight & { score: number })[] = []
  const nowMonthRows = rows.filter((r) => r.month === cur)

  // ── Category above / below usual
  for (const cat of catIds) {
    const name = names.get(cat) ?? 'A category'
    const sums = prevKeys.map((k) => rows.filter((r) => r.category === cat && r.month === k).reduce((a, r) => a + r.amount, 0))
    if (sums.filter((s) => s > 0).length < 2) continue
    const usual = sums.reduce((a, b) => a + b, 0) / 3
    const now_ = nowMonthRows.filter((r) => r.category === cat).reduce((a, r) => a + r.amount, 0)
    const pct = Math.round((Math.abs(now_ - usual) / usual) * 100)
    if (now_ >= usual * UP_RATIO && now_ - usual >= MIN_DIFF) {
      out.push({
        key: `category_up:${cat}:${cur}`,
        kind: 'category_up',
        tone: 'warn',
        title: `${name} is up`,
        message: `${name}: ${rupees(r2(now_))} so far this month, ${pct}% above your usual ${rupees(r2(usual))}.`,
        amount: r2(now_),
        filter: { categories: [cat], ...range },
        score: now_ - usual,
      })
    } else if (today.d >= DOWN_FROM_DAY && now_ <= usual * DOWN_RATIO && usual - now_ >= MIN_DIFF) {
      out.push({
        key: `category_down:${cat}:${cur}`,
        kind: 'category_down',
        tone: 'good',
        title: `${name} is down`,
        message: `${name}: ${rupees(r2(now_))} this month, ${pct}% below your usual ${rupees(r2(usual))}.`,
        amount: r2(now_),
        filter: { categories: [cat], ...range },
        score: usual - now_,
      })
    }
  }

  // ── Spending pace against last month by the same day
  const lastKey = monthKey(last.y, last.m)
  const upTo = Math.min(today.d, daysIn(last.y, last.m))
  const thisPace = nowMonthRows.filter((r) => r.day <= today.d).reduce((a, r) => a + r.amount, 0)
  const lastPace = rows.filter((r) => r.month === lastKey && r.day <= upTo).reduce((a, r) => a + r.amount, 0)
  const paceDiff = thisPace - lastPace
  if (lastPace > 0 && Math.abs(paceDiff) >= lastPace * PACE_RATIO && Math.abs(paceDiff) >= PACE_MIN) {
    const more = paceDiff > 0
    out.push({
      key: `pace:${cur}`,
      kind: 'pace',
      tone: more ? 'warn' : 'good',
      title: more ? 'Spending faster than last month' : 'Spending slower than last month',
      message: `You've spent ${rupees(r2(thisPace))} by the ${ordinal(today.d)}, ${rupees(r2(Math.abs(paceDiff)))} ${more ? 'more' : 'less'} than by this day last month.`,
      amount: r2(thisPace),
      filter: range,
      score: Math.abs(paceDiff),
    })
  }

  // ── Unusually large expense for its category
  const large: (Insight & { score: number })[] = []
  for (const r of nowMonthRows) {
    if (!r.category || r.amount < LARGE_MIN) continue
    const history = rows.filter((x) => x.category === r.category && prevKeys.includes(x.month)).map((x) => x.amount)
    if (history.length < 3) continue
    const usual = median(history)
    if (usual <= 0 || r.amount <= usual * LARGE_FACTOR) continue
    const name = names.get(r.category) ?? 'this category'
    large.push({
      key: `large:${r.id}:${cur}`,
      kind: 'large',
      tone: 'info',
      title: `${r.title}: ${rupees(r.amount)}`,
      message: `${rupees(r.amount)} is ${Math.round(r.amount / usual)}× your usual ${name} spend (${rupees(r2(usual))}).`,
      amount: r.amount,
      filter: { categories: [r.category], ...range, query: r.title },
      score: r.amount,
    })
  }
  out.push(...large.sort((a, b) => b.score - a.score).slice(0, 2))

  // ── First payment to a new payee (from bank SMS)
  const sms = await payload.find({
    collection: 'captured-sms',
    where: {
      and: [
        { user: { equals: userId } },
        { status: { equals: 'confirmed' } },
        { receivedAt: { greater_than_equal: monthStart.toISOString() } },
        { merchantKey: { exists: true } },
      ],
    },
    pagination: false,
    depth: 1,
    select: { merchantKey: true, parsed: true, transaction: true, receivedAt: true },
  })
  for (const s of sms.docs) {
    const key = s.merchantKey as string | null
    if (!key) continue
    const earlier = await payload.count({
      collection: 'captured-sms',
      where: {
        and: [
          { user: { equals: userId } },
          { merchantKey: { equals: key } },
          { status: { equals: 'confirmed' } },
          { receivedAt: { less_than: monthStart.toISOString() } },
        ],
      },
    })
    if (earlier.totalDocs > 0) continue
    const parsed = (s.parsed ?? {}) as { amount?: string; merchant?: string; type?: string }
    if (parsed.type && parsed.type !== 'expense') continue
    const tx = s.transaction as { amount?: string; amountValue?: number; title?: string } | null
    const amount = Number(tx?.amountValue ?? tx?.amount ?? parsed.amount) || 0
    if (amount < NEW_PAYEE_MIN) continue
    const who = parsed.merchant || key
    out.push({
      key: `new_payee:${key}:${cur}`,
      kind: 'new_payee',
      tone: 'info',
      title: `New payee: ${who}`,
      message: `First payment to ${who}: ${rupees(amount)}.`,
      amount,
      filter: { ...range, query: tx?.title || who },
      score: amount,
    })
  }

  // ── Budgets at 80% or over (ahead of everything else)
  for (const b of (await budgetsOverview(payload, userId, zone, now)).filter((x) => !x.archived)) {
    if (b.status === 'ok') continue
    const over = b.status === 'over'
    out.push({
      key: `budget:${b.id}:${cur}`,
      kind: 'budget',
      tone: 'warn',
      title: over ? `${b.category.name} budget exceeded` : `${b.category.name} budget at ${b.percent}%`,
      message: over
        ? `${rupees(b.spent)} of your ${rupees(b.amount)} budget — ${rupees(r2(-b.left))} over.`
        : `${rupees(b.spent)} of your ${rupees(b.amount)} budget used; ${rupees(b.left)} left.`,
      amount: b.spent,
      filter: { categories: b.categories, ...range },
      score: Number.MAX_SAFE_INTEGER - (over ? 0 : 1) - (100 - Math.min(b.percent, 100)),
    })
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX)
    .map(({ score: _score, ...i }) => i)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
