import React from 'react'

import { BudgetsEditor } from '@/components/web/BudgetsEditor'
import { requireSession } from '@/lib/session'
import { loadLookups } from '@/lib/web/transactions'
import { budgetsOverview } from '@/utilities/budgets'

export const metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const { payload, user, timeZone, currency } = await requireSession()
  const [budgets, lookups] = await Promise.all([budgetsOverview(payload, String(user.id), timeZone), loadLookups(payload, user)])
  const cats = lookups.categories.filter((c) => c.type === 'expense' && !c.archived)
  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="text-sm text-muted-foreground">Monthly limits per category. A parent category’s budget includes its subcategories.</p>
      </div>
      <BudgetsEditor
        currency={currency}
        categories={cats}
        budgets={budgets.map((b) => ({ id: b.id, category: b.category.id, name: b.category.name, icon: b.category.icon, color: b.category.color, bgColor: b.category.bgColor, amount: b.amount, spent: b.spent, percent: b.percent, status: b.status, archived: b.archived }))}
      />
    </div>
  )
}
