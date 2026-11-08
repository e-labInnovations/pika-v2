import { localParts } from '@/utilities/localMonth'
import { zone } from './format'

export type YM = { y: number; m: number }

/** `?month=YYYY-MM`, or the current month in the user's timezone. */
export function parseMonth(v: string | undefined, tz: string, now: Date = new Date()): YM {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? '')
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { y: Number(m[1]), m: Number(m[2]) }
  const p = localParts(now, zone(tz))
  return { y: p.y, m: p.m }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const monthKey = ({ y, m }: YM) => `${y}-${pad(m)}`

export function monthDays({ y, m }: YM): { from: string; to: string } {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
}

export function shiftMonth({ y, m }: YM, by: number): YM {
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
}
