import type { Payload, PayloadRequest } from 'payload'

export type Meal = 'Breakfast' | 'Lunch' | 'Evening' | 'Dinner'

const MEAL_WORD = /^(\s*)(breakfast|lunch|dinner|evening|supper)\b/i

/**
 * Bank SMS are Indian and their times IST. A timezone that was never set is stored as
 * UTC (the settings default), which would put a 12:30 lunch at 07:00, so read it as IST.
 */
const SMS_DEFAULT_ZONE = 'Asia/Kolkata'

/** The meal a local time falls in: 05–10 breakfast, 11–15 lunch, 16–18 evening, else dinner. */
export function mealFor(date: Date, timeZone: string): Meal {
  const zone = !timeZone || timeZone === 'UTC' ? SMS_DEFAULT_ZONE : timeZone
  let hour: number
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: zone }).format(date))
  } catch {
    hour = date.getUTCHours()
  }
  if (hour >= 5 && hour < 11) return 'Breakfast'
  if (hour >= 11 && hour < 16) return 'Lunch'
  if (hour >= 16 && hour < 19) return 'Evening'
  return 'Dinner'
}

/** Same letter case as `like`: all caps, all lower, or Title case. */
function matchCase(word: string, like: string): string {
  if (like === like.toUpperCase()) return word.toUpperCase()
  if (like === like.toLowerCase()) return word.toLowerCase()
  return word
}

/**
 * Titles reused from past transactions carry the meal word of that occasion ("Dinner -
 * Zomato order"). Swap a leading meal word for the one matching this transaction's time;
 * everything else is kept. Surrounding whitespace is trimmed.
 */
export function fixMealWord(title: string, date: Date, timeZone: string): string {
  const m = MEAL_WORD.exec(title)
  if (!m) return title
  const word = matchCase(mealFor(date, timeZone), m[2])
  return (word + title.slice(m[0].length)).trim()
}

/** The user's timezone setting, or UTC. */
export async function userTimeZone(payload: Payload, userId: string, req?: PayloadRequest): Promise<string> {
  try {
    const s = await payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      context: { internal: true },
      select: { timezone: true },
      req,
    })
    return (s.docs[0]?.timezone as string) || 'UTC'
  } catch {
    return 'UTC'
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_YEAR = new RegExp(`\\b(${MONTHS.map((m) => `${m.slice(0, 3)}(?:${m.slice(3)}|t)?`).join('|')})\\.?\\s+'?(\\d{4}|\\d{2})\\b`, 'i')

/**
 * Titles reused from a past month's payment carry its month ("Rent - Flat 7A (Aug 2026)").
 * Swap a month-and-year in the title for the payment's own, in the same style (short or
 * full month name, 2- or 4-digit year). Titles without a month and year are unchanged.
 */
export function refreshTitleMonth(title: string, date: Date, timeZone: string): string {
  const m = MONTH_YEAR.exec(title)
  if (!m) return title
  const zone = !timeZone || timeZone === 'UTC' ? SMS_DEFAULT_ZONE : timeZone
  let month: number
  let year: number
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { month: 'numeric', year: 'numeric', timeZone: zone }).formatToParts(date)
    month = Number(parts.find((p) => p.type === 'month')!.value) - 1
    year = Number(parts.find((p) => p.type === 'year')!.value)
  } catch {
    month = date.getUTCMonth()
    year = date.getUTCFullYear()
  }
  // "May" is both; treat it as short.
  const full = m[1].length > 3 && MONTHS.some((x) => x.toLowerCase() === m[1].toLowerCase())
  const name = full ? MONTHS[month] : MONTHS[month].slice(0, 3)
  const y = m[2].length === 2 ? String(year % 100).padStart(2, '0') : String(year)
  const word = m[1] === m[1].toUpperCase() ? name.toUpperCase() : name
  return title.slice(0, m.index) + m[0].replace(m[1], word).replace(m[2], y) + title.slice(m.index + m[0].length)
}
