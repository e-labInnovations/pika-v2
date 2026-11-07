/**
 * Dates for the MCP tools. Models think in the user's local time; the database stores
 * UTC. Plain dates and times are read as local; anything with Z or an offset is exact.
 * Replies show local time with the offset, so a mistake is visible.
 */

export const zoneOf = (tz: string | null | undefined) => (!tz || tz === 'UTC' ? 'Asia/Kolkata' : tz)

const HINT = 'Use local time as YYYY-MM-DD or YYYY-MM-DD HH:mm (e.g. "2026-11-07 14:30"), or ISO with Z/offset.'

/** Minutes the zone is ahead of UTC at `date`. */
export function offsetMinutes(date: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, number>>((a, x) => (x.type !== 'literal' && (a[x.type] = Number(x.value)), a), {})
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/** The UTC instant of a local wall-clock time in `timeZone`. */
export function localToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const wall = Date.UTC(y, m - 1, d, h, mi, s)
  let t = wall - offsetMinutes(new Date(wall), timeZone) * 60000
  t = wall - offsetMinutes(new Date(t), timeZone) * 60000 // settle across DST changes
  return new Date(t)
}

export function parseLocalDate(input: string, timeZone: string): Date {
  const s = String(input ?? '').trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) && /\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) throw new Error(`Bad date "${s}". ${HINT}`)
    return d
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
  if (!m) throw new Error(`Bad date "${s}". ${HINT}`)
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [h, mi, sec] = m[4] ? [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)] : [12, 0, 0]
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || sec > 59) {
    throw new Error(`Bad date "${s}". ${HINT}`)
  }
  return localToUtc(y, mo, d, h, mi, sec, zoneOf(timeZone))
}

/** "2026-11-07 14:30 (+05:30)" */
export function formatLocal(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const zone = zoneOf(timeZone)
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {})
  const off = offsetMinutes(d, zone)
  const sign = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  const oh = String(Math.floor(abs / 60)).padStart(2, '0')
  const om = String(abs % 60).padStart(2, '0')
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute} (${sign}${oh}:${om})`
}

/** Start (00:00) / end (23:59:59.999) of a local date "YYYY-MM-DD" as UTC ISO. */
export function localDayBound(input: string, timeZone: string, end: boolean): string {
  const s = String(input).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalDate(s, timeZone).toISOString()
  const [y, m, d] = s.split('-').map(Number)
  const start = localToUtc(y, m, d, 0, 0, 0, zoneOf(timeZone))
  if (!end) return start.toISOString()
  const next = localToUtc(y, m, d + 1, 0, 0, 0, zoneOf(timeZone))
  return new Date(next.getTime() - 1).toISOString()
}
