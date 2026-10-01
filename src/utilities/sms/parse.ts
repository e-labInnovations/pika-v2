/**
 * Bank/wallet SMS → structured transaction facts. Pure functions, no database.
 *
 * One parser per message format, grouped by provider. The phone only forwards SMS
 * from senders matching SMS_SENDERS (see `providerForSender`), so promotional and
 * OTP messages from other senders never reach the server. Formats were taken from a
 * real Android SMS export (2022–2026); dates in the messages are IST.
 */

export type SmsProvider = 'federal' | 'pluxee'

export type SmsKind =
  | 'upi_debit'
  | 'imps_debit'
  | 'imps_credit'
  | 'account_debit'
  | 'card_spend'
  | 'atm_withdrawal'
  | 'cash_deposit'
  | 'mandate'
  | 'meal_spend'
  | 'meal_credit'
  | 'reward_spend'
  | 'gift_card'
  | 'reversal'

export type ParsedSms = {
  provider: SmsProvider
  kind: SmsKind
  type: 'income' | 'expense' | 'transfer'
  /** Two-decimal string, matching how transactions store amounts. */
  amount: string
  /** ISO timestamp from the message; null when the message has no time. */
  occurredAt: string | null
  /** Payee or payer as written in the SMS (a name or a UPI ID). */
  merchant: string | null
  /** Bank reference (UPI/IMPS ref, card ref), when the message has one. */
  ref: string | null
  /** Tokens matched against an account's SMS identifiers: last 4 digits and keywords. */
  accountHints: string[]
  balance: string | null
  /** For refunds: when the original transaction happened (ISO). */
  reversalOf?: string | null
}

/** Sender ID substrings the phone forwards, and the provider each maps to. */
export const SMS_SENDERS: { pattern: string; provider: SmsProvider }[] = [
  { pattern: 'FEDBNK', provider: 'federal' },
  { pattern: 'PLUXEE', provider: 'pluxee' },
]

export function providerForSender(sender: string): SmsProvider | null {
  const s = sender.toUpperCase()
  return SMS_SENDERS.find((x) => s.includes(x.pattern))?.provider ?? null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const IST_OFFSET_MS = 330 * 60_000

const money = (s: string) => (Math.round(parseFloat(s.replace(/,/g, '')) * 100) / 100).toFixed(2)
const month = (s: string) => {
  const i = MONTHS.indexOf(s.slice(0, 3).toUpperCase())
  if (i < 0) throw new Error(`bad month ${s}`)
  return i + 1
}
const year = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s))
const last4 = (s: string) => s.replace(/\D/g, '').slice(-4)

/** IST wall-clock time → ISO (UTC). */
function ist(y: number, mo: number, d: number, h = 12, mi = 0, s = 0): string {
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - IST_OFFSET_MS).toISOString()
}

const cleanMerchant = (s: string) => s.replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim() || null

type Rule = {
  re: RegExp
  build: (m: RegExpMatchArray) => Omit<ParsedSms, 'provider'>
}

// ─── Federal Bank ─────────────────────────────────────────────────────────────

const AMT = String.raw`([\d,]+(?:\.\d+)?)`

const FEDERAL: Rule[] = [
  {
    // Rs 75.00 sent via UPI on 17-06-2026 at 18:46:50 to Kaicho.Ref:124892039761.Not you? …
    re: new RegExp(String.raw`^Rs\.? ?${AMT} sent via UPI on (\d{2})-(\d{2})-(\d{4}) at (\d{2}):(\d{2}):(\d{2}) to (.+?)\.Ref:? ?(\d+)`, 'i'),
    build: (m) => ({
      kind: 'upi_debit', type: 'expense', amount: money(m[1]),
      occurredAt: ist(+m[4], +m[3], +m[2], +m[5], +m[6], +m[7]),
      merchant: cleanMerchant(m[8]), ref: m[9], accountHints: [], balance: null,
    }),
  },
  {
    // Rs 1000.00 debited via UPI on 18-08-2025 11:16:59 to VPA x@oksbi.Ref No 559682766132.Small txns?…
    // Rs 26.00 debited from your A/c via UPI on 01-05-2024 18:19:19 to VPA x@oksbi.Ref No 412259440794.…
    re: new RegExp(String.raw`^Rs\.? ?${AMT} debited (?:from your A\/c )?via UPI on (\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) to VPA (\S+?)\.Ref No:? ?(\d+)`, 'i'),
    build: (m) => ({
      kind: 'upi_debit', type: 'expense', amount: money(m[1]),
      occurredAt: ist(+m[4], +m[3], +m[2], +m[5], +m[6], +m[7]),
      merchant: cleanMerchant(m[8]), ref: m[9], accountHints: [], balance: null,
    }),
  },
  {
    // Rs 239.00 debited from your A/c using UPI on 01-02-2023 21:44:46 and VPA x@icici credited (UPI Ref No 303273547465)
    // Rs 36.00 debited from your A/c using UPI on 07-03-2024 20:46:04 to VPA x@ybl - (UPI Ref No 406764843542)
    re: new RegExp(String.raw`^Rs\.? ?${AMT} debited from your A\/c using UPI on (\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) (?:and|to) VPA (\S+)(?: credited)?(?: -)? \(UPI Ref No:? ?(\d+)\)`, 'i'),
    build: (m) => ({
      kind: 'upi_debit', type: 'expense', amount: money(m[1]),
      occurredAt: ist(+m[4], +m[3], +m[2], +m[5], +m[6], +m[7]),
      merchant: cleanMerchant(m[8]), ref: m[9], accountHints: [], balance: null,
    }),
  },
  {
    // Debited Rs 45.00 from a/c X7497 on 28Sep26 08:56 via UPI to HOTEL AKSHAY. Ref 627193615547.Bal Rs 258127.54.…
    // Debited Rs 320000.00 from a/c X7497 on 29Jul26 12:19 via IMPS to XX588.Ref 621012478539. Bal Rs 114006.04.…
    re: new RegExp(String.raw`^Debited Rs\.? ?${AMT} from a\/c (X+\d+) on (\d{1,2})([A-Za-z]{3})(\d{2,4}) (\d{2}):(\d{2}) via (UPI|IMPS|NEFT|RTGS) to (.+?)\. ?Ref:? ?(\d+)\.? ?Bal:? ?Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: m[8].toUpperCase() === 'UPI' ? 'upi_debit' : 'imps_debit', type: 'expense', amount: money(m[1]),
      occurredAt: ist(year(m[5]), month(m[4]), +m[3], +m[6], +m[7]),
      merchant: cleanMerchant(m[9]), ref: m[10], accountHints: [last4(m[2])], balance: money(m[11]),
    }),
  },
  {
    // Rs 8000 credited to your A/c XX7497 via IMPS on 17JUL2026 18:49:46 IMPS Ref no 619827062008 Bal:Rs 440138.80
    re: new RegExp(String.raw`^Rs\.? ?${AMT} credited to your A\/c (X+\d+) via (IMPS|NEFT|UPI|RTGS) on (\d{1,2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2}) (?:\w+ )?Ref no:? ?(\w+) Bal:? ?Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'imps_credit', type: 'income', amount: money(m[1]),
      occurredAt: ist(year(m[6]), month(m[5]), +m[4], +m[7], +m[8], +m[9]),
      merchant: null, ref: m[10], accountHints: [last4(m[2])], balance: money(m[11]),
    }),
  },
  {
    // Your a/c no. XXXXXXXXXX7497 is debited for Rs.58518.44 on 30-09-2025 and a/c XXXXXXXX185 credited (IMPS Ref no. 527310321419)
    // A/c. XXXXXXXXXX7497 debited for Rs.58472.00 on 31-10-2025 and XXXXXXXX581 credited (IMPS Ref no. 530409984492).
    re: new RegExp(String.raw`a\/c(?:\.| no\.) (X+\d+) (?:is )?debited for Rs\.? ?${AMT} on (\d{2})-(\d{2})-(\d{4}) and (?:a\/c )?(X+\d+) credited \((?:IMPS|NEFT|RTGS) Ref no\.? ?(\d+)\)`, 'i'),
    build: (m) => ({
      kind: 'imps_debit', type: 'expense', amount: money(m[2]),
      occurredAt: null,
      merchant: `A/c XX${m[6].replace(/\D/g, '')}`, ref: m[7], accountHints: [last4(m[1])], balance: null,
    }),
  },
  {
    // Rs 503 spent@ WWW AMAZON on 29MAY26 09:46 Bal Rs 299939.57 Ref 783126. Not you? Call …/ SMS NO 7497 to 9895088888
    // Rs170 spent@E Treasury on 04DEC21 12:20.BAL:Rs129.29.Dispute/Not you?… /SMS 7497 to 9895088888
    re: new RegExp(String.raw`^Rs\.? ?${AMT} (spent|withdrawn)@ ?(.+?) on (\d{2})([A-Za-z]{3})(\d{2}) (\d{2}):(\d{2})\.? ?Bal:? ?Rs\.? ?${AMT}\.?(?: Ref (\d+))?.*?SMS (?:NO )?(\d{4}) to`, 'i'),
    build: (m) => {
      const atm = m[2].toLowerCase() === 'withdrawn'
      return {
        kind: atm ? 'atm_withdrawal' : 'card_spend', type: atm ? 'transfer' : 'expense', amount: money(m[1]),
        occurredAt: ist(year(m[6]), month(m[5]), +m[4], +m[7], +m[8]),
        merchant: cleanMerchant(m[3]), ref: m[10] ?? null, accountHints: [m[11]], balance: money(m[9]),
      }
    },
  },
  {
    // Thanks for choosing FedMobile.Rs.50000 is debited from your A/c XX7497 on 30SEP2025 10:31:50. Bal:Rs.87167.25
    // Thank you for using FEDNET.Rs.585 debited from your A/c XX7497 on 08JAN2025 14:24:44. BAL-Rs.121476.58
    re: new RegExp(String.raw`Rs\.? ?${AMT} (?:is )?debited from your A\/c (X+\d+) on (\d{1,2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})\. ?Bal[:-]? ?Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'account_debit', type: 'expense', amount: money(m[1]),
      occurredAt: ist(year(m[5]), month(m[4]), +m[3], +m[6], +m[7], +m[8]),
      merchant: null, ref: null, accountHints: [last4(m[2])], balance: money(m[9]),
    }),
  },
  {
    // …mandate with ref no- …@okaxis registered against LinkedIn for Rs 2.00 successfully executed on 23-07-2026 19:21:18. TXN Ref No -110280395752-
    re: new RegExp(String.raw`registered against (.+?) for Rs\.? ?${AMT} successfully executed on (\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})\. ?TXN Ref No ?-?(\d+)`, 'i'),
    build: (m) => ({
      kind: 'mandate', type: 'expense', amount: money(m[2]),
      occurredAt: ist(+m[5], +m[4], +m[3], +m[6], +m[7], +m[8]),
      merchant: cleanMerchant(m[1]), ref: m[9], accountHints: [], balance: null,
    }),
  },
  // Older (2021) formats, kept in case they come back.
  {
    // Rs.1622.08 spent on card XX5348 at GODADDY INDIA D on 04NOV2021 15:50:59. BAL-Rs.6853.69. … SMS NO 7497 to …
    re: new RegExp(String.raw`^Rs\.? ?${AMT} spent on card X+\d+ at (.+?) on (\d{1,2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})\. ?BAL[:-]? ?Rs\.? ?${AMT}.*?SMS (?:NO )?(\d{4}) to`, 'i'),
    build: (m) => ({
      kind: 'card_spend', type: 'expense', amount: money(m[1]),
      occurredAt: ist(year(m[5]), month(m[4]), +m[3], +m[6], +m[7], +m[8]),
      merchant: cleanMerchant(m[2]), ref: null, accountHints: [m[10]], balance: money(m[9]),
    }),
  },
  {
    // Rs.500 debited from A/c XX7497 via KOZHICHENA ATM on 16OCT2021 16:03:52.BAL-Rs.1717.32.
    re: new RegExp(String.raw`^Rs\.? ?${AMT} debited from A\/c (X+\d+) via (.+?) ATM on (\d{1,2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})\. ?BAL[:-]? ?Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'atm_withdrawal', type: 'transfer', amount: money(m[1]),
      occurredAt: ist(year(m[6]), month(m[5]), +m[4], +m[7], +m[8], +m[9]),
      merchant: cleanMerchant(m[3]), ref: null, accountHints: [last4(m[2])], balance: money(m[10]),
    }),
  },
  {
    // Hi,Rs.8000credited in your A/c XX7497 on 07OCT2021 10:49:19 using cash deposit machine at FBL-CHELARI. Current Bal: Rs.13163.32
    re: new RegExp(String.raw`Rs\.? ?${AMT} ?credited in your A\/c (X+\d+) on (\d{1,2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2}) using cash deposit machine at (.+?)\. ?Current Bal:? ?Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'cash_deposit', type: 'transfer', amount: money(m[1]),
      occurredAt: ist(year(m[5]), month(m[4]), +m[3], +m[6], +m[7], +m[8]),
      merchant: cleanMerchant(m[9]), ref: null, accountHints: [last4(m[2])], balance: money(m[10]),
    }),
  },
]

// ─── Pluxee ───────────────────────────────────────────────────────────────────

const PLUXEE: Rule[] = [
  {
    // Rs. 164.69 spent from Pluxee Meal wallet, card no.xx7618 on 27-09-2026 19:05:54 at ETERNAL LIM . Avl bal Rs.20602.63.
    // Rs. 10299.00 spent from Pluxee Reward wallet, card no.xx6916 on 25-01-2025 21:04:6 at FLIPKARTINT . Avl bal Rs.5101.00.
    re: new RegExp(String.raw`^Rs\.? ?${AMT} spent from Pluxee (Meal|Reward) wallet, card no\.? ?(?:xx(\d{4}))?,? on (\d{1,2})-(\d{1,2})-(\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2}) at (.+?) ?\. ?Avl bal Rs\.? ?${AMT}`, 'i'),
    build: (m) => {
      const meal = m[2].toLowerCase() === 'meal'
      return {
        kind: meal ? 'meal_spend' : 'reward_spend', type: 'expense', amount: money(m[1]),
        occurredAt: ist(+m[6], +m[5], +m[4], +m[7], +m[8], +m[9]),
        merchant: cleanMerchant(m[10]), ref: null,
        accountHints: [m[3], meal ? 'pluxee-meal' : 'pluxee-reward'].filter(Boolean), balance: money(m[11]),
      }
    },
  },
  {
    // Rs. 115.00 was spent from Meal Wallet linked to your Pluxee Card xx7618 on 24-02-2024 19:32:18 at SWIGGY. Txn no. 447043147692. Avl bal is Rs. 1365.00.
    re: new RegExp(String.raw`^Rs\.? ?${AMT} was spent from Meal Wallet linked to your Pluxee Card xx(\d{4}) on (\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) at (.+?)\. Txn no\.? ?(\d+)\. Avl bal is Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'meal_spend', type: 'expense', amount: money(m[1]),
      occurredAt: ist(+m[5], +m[4], +m[3], +m[6], +m[7], +m[8]),
      merchant: cleanMerchant(m[9]), ref: m[10], accountHints: [m[2], 'pluxee-meal'], balance: money(m[11]),
    }),
  },
  {
    // Your Pluxee Card has been successfully credited with Rs.10800 towards Meal Wallet on Fri Sep 11 2026 11:42:21. Your current Meal Wallet balance is Rs.22888.65.
    re: new RegExp(String.raw`credited with Rs\.? ?${AMT} towards Meal Wallet on \w{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4}) (\d{2}):(\d{2}):(\d{2})\. ?Your current Meal Wallet balance is Rs\.? ?${AMT}`, 'i'),
    build: (m) => ({
      kind: 'meal_credit', type: 'income', amount: money(m[1]),
      occurredAt: ist(+m[4], month(m[2]), +m[3], +m[5], +m[6], +m[7]),
      merchant: null, ref: null, accountHints: ['pluxee-meal'], balance: money(m[8]),
    }),
  },
  {
    // Your Pluxee Card xx7618 has been credited with INR 92.75 on Fri May 01 2026 12:47:11as a reversal against a previous transaction on May 01,2026 09:42:42.
    re: new RegExp(String.raw`Pluxee Card xx(\d{4}) has been credited with INR ${AMT} on \w{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) ?as a reversal against a previous transaction on ([A-Za-z]{3}) (\d{1,2}), ?(\d{4}) (\d{2}):(\d{2}):(\d{2})`, 'i'),
    build: (m) => ({
      kind: 'reversal', type: 'income', amount: money(m[2]),
      occurredAt: ist(+m[5], month(m[3]), +m[4], +m[6], +m[7], +m[8]),
      merchant: null, ref: null, accountHints: [m[1]], balance: null,
      reversalOf: ist(+m[11], month(m[9]), +m[10], +m[12], +m[13], +m[14]),
    }),
  },
  {
    // You have received a Pluxee Card worth Rs. 7000 from THOUGHTSPOT INDIA PRIVATE LIMITED.
    re: new RegExp(String.raw`received a Pluxee Card worth Rs\.? ?${AMT} from (.+?)\.?$`, 'i'),
    build: (m) => ({
      kind: 'gift_card', type: 'income', amount: money(m[1]),
      occurredAt: null, merchant: cleanMerchant(m[2]), ref: null, accountHints: ['pluxee-reward'], balance: null,
    }),
  },
]

const RULES: Record<SmsProvider, Rule[]> = { federal: FEDERAL, pluxee: PLUXEE }

/** Parses one SMS. Returns null for messages that are not a transaction (OTP, promo, …). */
export function parseSms(sender: string, body: string): ParsedSms | null {
  const provider = providerForSender(sender)
  if (!provider) return null
  const text = body.replace(/\s+/g, ' ').trim()
  for (const rule of RULES[provider]) {
    const m = text.match(rule.re)
    if (!m) continue
    try {
      return { provider, ...rule.build(m) }
    } catch {
      return null
    }
  }
  return null
}

/** True for messages that mention money moving but matched no rule: worth keeping to add a rule later. */
export function looksFinancial(body: string): boolean {
  return /\b(rs\.?|inr)\s?[\d,]+/i.test(body) && /(debited|credited|spent|withdrawn|sent|received)/i.test(body) && !/\botp\b|created a mandate|requested money/i.test(body)
}
