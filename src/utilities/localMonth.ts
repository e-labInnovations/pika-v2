/** Calendar months in the user's timezone (dates are stored in UTC). */

export type Local = { y: number; m: number; d: number }

export function localParts(date: Date, timeZone: string): Local {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {})
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) }
}

/** The UTC instant of local midnight on y-m-d in `timeZone`. */
export function localMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d))
  const seen = localParts(guess, timeZone)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(guess),
  )
  const minute = Number(new Intl.DateTimeFormat('en-GB', { timeZone, minute: 'numeric' }).format(guess))
  // Local time at `guess` is (seen, hour:minute); step back to midnight of y-m-d.
  let ms = guess.getTime() - (hour * 60 + minute) * 60_000
  if (Date.UTC(seen.y, seen.m - 1, seen.d) > Date.UTC(y, m - 1, d)) ms -= 86_400_000
  if (Date.UTC(seen.y, seen.m - 1, seen.d) < Date.UTC(y, m - 1, d)) ms += 86_400_000
  return new Date(ms)
}

export const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
export const shift = (y: number, m: number, by: number) => {
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
}

/** First and last instant of the local month containing `now`, as ISO strings. */
export function monthRange(now: Date, timeZone: string): { dateFrom: string; dateTo: string; key: string } {
  const t = localParts(now, timeZone)
  const next = shift(t.y, t.m, 1)
  return {
    dateFrom: localMidnight(t.y, t.m, 1, timeZone).toISOString(),
    dateTo: new Date(localMidnight(next.y, next.m, 1, timeZone).getTime() - 1).toISOString(),
    key: monthKey(t.y, t.m),
  }
}

/** A timezone never set is stored as UTC; the app's users are in India. */
export const userZone = (tz: string | null | undefined) => (!tz || tz === 'UTC' ? 'Asia/Kolkata' : tz)
