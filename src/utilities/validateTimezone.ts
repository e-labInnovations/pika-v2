import { timezones } from '../data/timezones'

const validTimezoneIds = new Set(timezones.map((tz) => tz.id))

export const validateTimezone = (value: string | null | undefined): true | string => {
  if (!value) return 'Timezone is required'
  if (!validTimezoneIds.has(value)) return `'${value}' is not a valid IANA timezone`
  return true
}
