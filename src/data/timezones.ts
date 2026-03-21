export type TimezoneInfo = {
  id: string        // IANA name e.g. "America/New_York"
  region: string   // "America"
  city: string     // "New York"
  offset: string   // "+05:30"
  label: string    // "New York (EST, GMT+05:30)"
}

// Legacy IANA IDs that still appear in some Node/V8 builds — map to modern city names
const cityOverrides: Record<string, string> = {
  'Asia/Calcutta': 'Kolkata',
  'Asia/Bombay': 'Mumbai',
  'Asia/Katmandu': 'Kathmandu',
  'Asia/Dacca': 'Dhaka',
  'Asia/Rangoon': 'Yangon',
  'Asia/Saigon': 'Ho Chi Minh City',
  'Pacific/Truk': 'Chuuk',
  'Pacific/Ponape': 'Pohnpei',
}

function buildTimezoneInfo(id: string): TimezoneInfo {
  const parts = id.split('/')
  const region = parts[0]
  const city = cityOverrides[id] ?? (parts[parts.length - 1] ?? id).replace(/_/g, ' ')

  let offset = '+00:00'
  let abbr = 'UTC'

  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      timeZoneName: 'short',
    })
    const abbrMatch = formatter.formatToParts(now).find((p) => p.type === 'timeZoneName')
    abbr = abbrMatch?.value ?? 'UTC'

    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      timeZoneName: 'longOffset',
    })
    const offsetMatch = offsetFormatter.formatToParts(now).find((p) => p.type === 'timeZoneName')
    const raw = offsetMatch?.value ?? 'GMT+00:00'
    offset = raw.replace('GMT', '') || '+00:00'
  } catch {
    // keep defaults for invalid zones
  }

  return {
    id,
    region,
    city,
    offset,
    label: `${city} (${abbr}, GMT${offset})`,
  }
}

export const timezones: TimezoneInfo[] = Intl.supportedValuesOf('timeZone')
  .map(buildTimezoneInfo)
  .sort((a, b) => a.id.localeCompare(b.id))
