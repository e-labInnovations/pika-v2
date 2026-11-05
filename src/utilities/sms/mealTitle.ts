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
