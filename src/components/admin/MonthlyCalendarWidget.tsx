'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import DynamicIcon from '@/components/lucide/dynamic-icon'

type CalendarDay = {
  date: string
  income: number
  expenses: number
  balance: number
  transactionCount: number
}

type CalendarMeta = {
  month: number
  year: number
  monthName: string
  totalIncome: number
  totalExpenses: number
  balance: number
}

type CalendarData = { data: CalendarDay[]; meta: CalendarMeta }

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US')
}

function addMonth(month: number, year: number, delta: 1 | -1) {
  let m = month + delta
  let y = year
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  return { month: m, year: y }
}

export default function MonthlyCalendarWidget() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [calData, setCalData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/monthly-calendar?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => setCalData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, year])

  // Build calendar grid cells
  const firstDow = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()

  const byDate: Record<string, CalendarDay> = {}
  calData?.data.forEach((d) => { byDate[d.date] = d })

  type Cell = { day: number; current: boolean; dateStr: string | null }
  const cells: Cell[] = []

  for (let i = firstDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrevMonth - i, current: false, dateStr: null })

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, current: true, dateStr })
  }

  const rem = cells.length % 7
  if (rem !== 0)
    for (let d = 1; d <= 7 - rem; d++)
      cells.push({ day: d, current: false, dateStr: null })

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="twp rounded-xl border border-[var(--theme-border-color)] bg-[var(--theme-elevation-50)] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => { const r = addMonth(month, year, -1); setMonth(r.month); setYear(r.year) }}
          className="rounded p-1.5 opacity-40 transition hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
        >
          <DynamicIcon name="chevron-left" size={16} />
        </button>

        <h3 className="text-base font-bold text-[var(--theme-text)]">
          {loading ? '…' : `${calData?.meta.monthName ?? ''} ${year}`}
        </h3>

        <button
          type="button"
          onClick={() => { const r = addMonth(month, year, 1); setMonth(r.month); setYear(r.year) }}
          className="rounded p-1.5 opacity-40 transition hover:bg-[var(--theme-elevation-100)] hover:opacity-100"
        >
          <DynamicIcon name="chevron-right" size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-1 text-center text-xs font-medium opacity-40">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const day = cell.dateStr ? byDate[cell.dateStr] : null
          const hasActivity = day && day.transactionCount > 0
          const balance = day?.balance ?? 0
          const isToday = cell.dateStr === todayStr

          return (
            <div
              key={idx}
              className={cn(
                'flex flex-col items-center py-2',
                !cell.current && 'opacity-25',
              )}
            >
              <span
                className={cn(
                  'text-sm leading-none',
                  isToday && 'flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white',
                )}
              >
                {cell.day}
              </span>

              <span
                className={cn(
                  'mt-1 text-xs font-medium leading-none',
                  !hasActivity && 'opacity-20',
                  hasActivity && balance > 0 && 'text-emerald-500',
                  hasActivity && balance < 0 && 'text-red-400',
                  hasActivity && balance === 0 && 'opacity-40',
                )}
              >
                {hasActivity ? fmt(balance) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer totals */}
      {calData && !loading && (
        <div className="mt-3 flex justify-around border-t border-[var(--theme-border-color)] pt-3 text-xs">
          <span className="text-emerald-500">+{fmt(calData.meta.totalIncome)}</span>
          <span className="opacity-30">|</span>
          <span className="text-red-400">-{fmt(calData.meta.totalExpenses)}</span>
          <span className="opacity-30">|</span>
          <span className={calData.meta.balance >= 0 ? 'text-emerald-500' : 'text-red-400'}>
            {calData.meta.balance >= 0 ? '+' : '-'}{fmt(calData.meta.balance)}
          </span>
        </div>
      )}
    </div>
  )
}
