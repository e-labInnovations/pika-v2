/** Splitting an expense with friends; all maths in paise so it adds up exactly. */

const paise = (n: number | string) => Math.round(Number(n) * 100)
const rupees = (p: number) => (p / 100).toFixed(2)

/** Friends' shares when the bill is split evenly between me and `friends` people (I absorb the rounding). */
export function evenShares(total: number, friends: number): string[] {
  if (friends <= 0) return []
  const each = Math.floor(paise(total) / (friends + 1))
  return Array.from({ length: friends }, () => rupees(each))
}

/** What's left for me after the friends' shares. */
export function myShare(total: number, shares: (string | number)[]): string {
  return rupees(paise(total) - shares.reduce<number>((s, a) => s + paise(a), 0))
}
