import type { Payload } from 'payload'

export type Meal = 'Breakfast' | 'Lunch' | 'Evening' | 'Dinner'

const MEAL_WORD = /^(\s*)(breakfast|lunch|dinner|evening|supper)\b/i

/** The meal a local time falls in: 05–10 breakfast, 11–15 lunch, 16–18 evening, else dinner. */
export function mealFor(date: Date, timeZone: string): Meal {
  let hour: number
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date))
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
export async function userTimeZone(payload: Payload, userId: string): Promise<string> {
  try {
    const s = await payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      context: { internal: true },
      select: { timezone: true },
    })
    return (s.docs[0]?.timezone as string) || 'UTC'
  } catch {
    return 'UTC'
  }
}
