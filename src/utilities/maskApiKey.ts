/**
 * Masks an API key for safe display: shows first 6 + **** + last 4 chars.
 * Example: "AIzaSyABCDEFGHIJKLMNOP" → "AIzaSy****MNOP"
 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length < 10) return '****'
  return `${key.slice(0, 6)}****${key.slice(-4)}`
}

/**
 * Returns true if the value is a masked key (i.e. was not changed by the user).
 */
export function isMaskedKey(value: string): boolean {
  return typeof value === 'string' && value.includes('****')
}
