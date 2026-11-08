/** Display helpers for the web dashboard. Pure. */

/** The user's timezone; one never set is stored as UTC, and Pika's users are in India. */
export const zone = (tz?: string | null): string => (!tz || tz === 'UTC' ? 'Asia/Kolkata' : tz)

const moneyFormats = new Map<string, Intl.NumberFormat>()

export function formatMoney(n: number, currency = 'INR'): string {
  let f = moneyFormats.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    moneyFormats.set(currency, f)
  }
  return f.format(n)
}

/** -₹50.00 for an expense, +₹50.00 for income, ₹50.00 for a transfer. */
export function formatSigned(n: number, type: string, currency = 'INR'): string {
  const s = formatMoney(Math.abs(n), currency)
  return type === 'expense' ? `-${s}` : type === 'income' ? `+${s}` : s
}

/** 8 Nov 2026 */
export function formatLocalDate(iso: string, tz?: string | null): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone(tz), day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

/** 8 Nov 2026, 14:30 */
export function formatLocalDateTime(iso: string, tz?: string | null): string {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone(tz), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return `${formatLocalDate(iso, tz)}, ${time}`
}

/** The local calendar day (YYYY-MM-DD) of an instant. */
export function localDay(iso: string | Date, tz?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** Value for an <input type="datetime-local">: YYYY-MM-DDTHH:mm in local time. */
export function localInputValue(iso: string, tz?: string | null): string {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone(tz), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return `${localDay(iso, tz)}T${time}`
}
