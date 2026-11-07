import type { Payload } from 'payload'
import { monthRange, userZone } from './localMonth'

export type BudgetProgress = {
  id: string
  category: { id: string; name: string; icon: string | null; color: string | null; bgColor: string | null }
  /** Monthly limit. */
  amount: number
  spent: number
  /** Negative when over. */
  left: number
  percent: number
  status: 'ok' | 'warn' | 'over'
  /** The category and its subcategories, for opening History. */
  categories: string[]
}

export const BUDGET_WARN_PERCENT = 80

const r2 = (n: number) => Math.round(n * 100) / 100
const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

/**
 * The user's active budgets with this local month's spending (expenses in the category
 * and, for a parent category, its subcategories; full amounts as in other analytics).
 * Most used first.
 */
export async function budgetsOverview(
  payload: Payload,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<BudgetProgress[]> {
  const budgets = await payload.find({
    collection: 'budgets',
    where: { and: [{ user: { equals: userId } }, { isActive: { not_equals: false } }] },
    pagination: false,
    depth: 1,
  })
  if (!budgets.docs.length) return []

  const { dateFrom, dateTo } = monthRange(now, userZone(timeZone))
  const ids = budgets.docs.map((b) => idOf(b.category)).filter((x): x is string => !!x)
  const children = await payload.find({
    collection: 'categories',
    where: { parent: { in: ids } },
    pagination: false,
    depth: 0,
    select: { parent: true },
  })
  const scope = new Map<string, string[]>(ids.map((id) => [id, [id]]))
  for (const c of children.docs) scope.get(idOf(c.parent)!)?.push(String(c.id))

  const txs = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { user: { equals: userId } },
        { isActive: { equals: true } },
        { type: { equals: 'expense' } },
        { category: { in: [...new Set([...scope.values()].flat())] } },
        { date: { greater_than_equal: dateFrom } },
        { date: { less_than_equal: dateTo } },
      ],
    },
    pagination: false,
    depth: 0,
    select: { amount: true, amountValue: true, category: true },
  })
  const byCat = new Map<string, number>()
  for (const t of txs.docs) {
    const c = idOf(t.category)!
    byCat.set(c, (byCat.get(c) ?? 0) + (typeof t.amountValue === 'number' ? t.amountValue : Number(t.amount) || 0))
  }

  return budgets.docs
    .map((b) => {
      const cat = (typeof b.category === "object" ? b.category : {}) as unknown as Record<string, unknown>
      const id = idOf(b.category)!
      const cats = scope.get(id) ?? [id]
      const spent = r2(cats.reduce((a, c) => a + (byCat.get(c) ?? 0), 0))
      const amount = Number(b.amount) || 0
      const percent = amount > 0 ? Math.round((spent / amount) * 100) : 0
      return {
        id: String(b.id),
        category: {
          id,
          name: String(cat.name ?? ''),
          icon: (cat.icon as string) ?? null,
          color: (cat.color as string) ?? null,
          bgColor: (cat.bgColor as string) ?? null,
        },
        amount,
        spent,
        left: r2(amount - spent),
        percent,
        status: (percent >= 100 && spent > amount ? 'over' : percent >= BUDGET_WARN_PERCENT ? 'warn' : 'ok') as BudgetProgress['status'],
        categories: cats,
      }
    })
    .sort((a, b) => b.percent - a.percent)
}
