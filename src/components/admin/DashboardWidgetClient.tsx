'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'
import type { DashboardData } from '@/utilities/calculateDashboard'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
}

export function DashboardWidgetClient({ data }: { data: DashboardData }) {
  const [hidden, setHidden] = useState(true)

  const pulse = data.monthlyPulse
  const pct = data.balanceChangePercent
  const isPositive = (pct ?? 0) >= 0

  return (
    <div className="twp grid gap-4 sm:grid-cols-2">
      {/* Total Balance */}
      <div
        style={{
          background: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium opacity-60">Total Balance</span>
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className="rounded-full p-1.5 opacity-50 transition hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
          >
            <DynamicIcon name={hidden ? 'eye-off' : 'eye'} size={16} />
          </button>
        </div>

        <p className="text-3xl font-bold tracking-tight text-[var(--theme-text)]">
          {hidden ? (
            <span className="opacity-40">$** *** **</span>
          ) : (
            <>
              <span className="opacity-50">$</span>
              {formatCurrency(data.totalBalance)}
            </>
          )}
        </p>

        {pct !== null && pct !== undefined && (
          <div
            className={cn(
              'mt-3 flex items-center gap-1.5 text-sm font-medium',
              isPositive ? 'text-emerald-500' : 'text-red-400',
            )}
          >
            <DynamicIcon name={isPositive ? 'trending-up' : 'trending-down'} size={14} />
            <span>
              {isPositive ? '+' : ''}
              {pct}% from last month
            </span>
          </div>
        )}
      </div>

      {/* Monthly Pulse */}
      <div
        style={{
          background: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
        }}
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider opacity-50">
          Monthly Pulse
          <span className="ml-1.5 normal-case opacity-70">
            — {pulse.monthName} {pulse.year}
          </span>
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-60">Income</span>
            <span className={cn('font-semibold', hidden ? 'opacity-30' : 'text-emerald-500')}>
              {hidden ? '••••••' : `+$${formatCurrency(pulse.income)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-60">Expenses</span>
            <span className={cn('font-semibold', hidden ? 'opacity-30' : 'text-red-400')}>
              {hidden ? '••••••' : `-$${formatCurrency(pulse.expenses)}`}
            </span>
          </div>
          <div className="my-1 border-t border-[var(--theme-border-color)]" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Surplus</span>
            <span
              className={cn(
                'font-bold',
                hidden ? 'opacity-30' : pulse.surplus >= 0 ? 'text-emerald-500' : 'text-red-400',
              )}
            >
              {hidden
                ? '••••••'
                : `${pulse.surplus >= 0 ? '+' : '-'}$${formatCurrency(pulse.surplus)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
