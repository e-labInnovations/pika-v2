'use client'

import { useState } from 'react'
import type { MonthlyCategoriesResult, CategoryActivity } from '@/utilities/calculateMonthlyCategories'
import DynamicIcon from '@/components/lucide/dynamic-icon'

function fmtAmount(n: number): string {
  return Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function IconCircle({
  icon,
  color,
  bgColor,
  size = 9,
}: {
  icon: string | null
  color: string | null
  bgColor?: string
  size?: number
}) {
  const px = size * 4
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: px, height: px, background: bgColor ?? 'rgba(0,0,0,0.25)' }}
    >
      <DynamicIcon name={(icon as any) ?? 'circle'} size={size * 4 * 0.4} color={color ?? '#fff'} />
    </div>
  )
}

export function MonthlyCategoryWidgetClient({ data }: { data: MonthlyCategoriesResult }) {
  // per-parent collapse state — default all expanded
  const [parentCollapsed, setParentCollapsed] = useState<Record<string, boolean>>({})

  const parents = data.data.filter((c) => c.isParent && c.amount > 0)

  const childrenOf = (parentId: string): CategoryActivity[] =>
    data.data.filter((c) => c.parentId === parentId && c.amount > 0)

  const toggleParent = (id: string) =>
    setParentCollapsed((s) => ({ ...s, [id]: !s[id] }))

  const parentIds = parents.map((p) => p.id)
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => parentCollapsed[id])
  const toggleAll = () => {
    const next = !allCollapsed
    setParentCollapsed(Object.fromEntries(parentIds.map((id) => [id, next])))
  }

  return (
    <div
      className="twp"
      style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-border-color)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
      }}
    >
      {/* Widget header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--theme-text)]">
          Category Spending{' '}
          <span className="font-normal opacity-50">
            — {data.meta.monthName} {data.meta.year}
          </span>
        </h3>
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-full p-1.5 opacity-50 transition hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
        >
          <DynamicIcon name={allCollapsed ? 'chevron-down' : 'chevron-up'} size={16} />
        </button>
      </div>

      <div className="space-y-1.5">
          {parents.length === 0 && (
            <p className="text-sm opacity-40">No expenses this month.</p>
          )}

          {parents.map((parent) => {
            const children = childrenOf(parent.id)
            const hasChildren = children.length > 0
            const isCollapsed = parentCollapsed[parent.id] ?? false

            return (
              <div key={parent.id}>
                {/* Parent row */}
                <div
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: parent.bgColor ?? 'var(--theme-elevation-100)' }}
                >
                  {/* Icon acts as toggle button when children exist */}
                  <button
                    type="button"
                    onClick={() => hasChildren && toggleParent(parent.id)}
                    className="flex-shrink-0"
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                  >
                    <IconCircle icon={parent.icon} color={parent.color} />
                  </button>

                  <span
                    className="flex-1 text-sm font-bold"
                    style={{ color: parent.color ?? '#fff' }}
                  >
                    {parent.name}
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{ color: parent.color ?? '#fff' }}
                  >
                    {fmtAmount(parent.amount)}
                  </span>

                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleParent(parent.id)}
                      className="flex-shrink-0 opacity-60 transition hover:opacity-100"
                    >
                      <DynamicIcon
                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                        size={14}
                        color={parent.color ?? '#fff'}
                      />
                    </button>
                  )}
                </div>

                {/* Children */}
                {!isCollapsed &&
                  children.map((child) => (
                    <div
                      key={child.id}
                      className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{
                        background: child.bgColor ?? 'var(--theme-elevation-100)',
                        marginLeft: '0.75rem',
                      }}
                    >
                      <IconCircle icon={child.icon} color={child.color} size={7} />
                      <span
                        className="flex-1 text-xs font-medium"
                        style={{ color: child.color ?? '#fff' }}
                      >
                        {child.name}
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: child.color ?? '#fff' }}
                      >
                        {fmtAmount(child.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            )
          })}
      </div>
    </div>
  )
}
