// ─── Text → Transaction ────────────────────────────────────────────────────────

export const TEXT_TO_TRANSACTION_SYSTEM = `You are an expert financial transaction analyzer specializing in SMS, natural language descriptions, and text analysis for a money management application. You must return only valid JSON in the exact format specified. Do not include any explanations or extra text.`

export function buildTextToTransactionPrompt(p: {
  text: string
  categories: string
  tags: string
  accounts: string
  people: string
  timezone: string
  currentDatetime: string
}): string {
  return `
Analyze the provided text (SMS, natural language descriptions, transaction details, or user descriptions) and extract comprehensive transaction data. Return structured JSON data based on the content type and patterns.

INPUT TEXT:
${p.text}

AVAILABLE CATEGORIES (tree — pick a CHILD id from "- <id>: name — desc" lines; "### <type>" and "## <parent>" are context only, never return them):
${p.categories}

AVAILABLE TAGS (use ID only):
${p.tags}

AVAILABLE ACCOUNTS (use ID only):
${p.accounts}

AVAILABLE PEOPLE (use ID only):
${p.people}

CURRENT DATE AND TIME (User Timezone: ${p.timezone}):
${p.currentDatetime}

CATEGORY RULES (STRICT):
- The category type MUST match the transaction type exactly: expense→expense, income→income, transfer→transfer
- If no suitable category matches, use empty string ""

ANALYSIS RULES:

**NATURAL LANGUAGE PATTERNS:**
- "Spend X rupees from [account] for [purpose]" = EXPENSE
- "Gave X rupees from [account] to [person] as [purpose]" = EXPENSE (lending)
- "Paid X rupees [purpose] as [payment_method]" = EXPENSE
- "Bus, X, [time], [payment_method]" = EXPENSE (transportation)
- "Train, X, [account], [time] [date], [route]" = EXPENSE (transportation)
- Extract: amount, purpose, account, person, payment method, time, date, route
- Smart categorization based on purpose and context

**SMART PARSING RULES:**
- **Amount Detection**: Look for numbers followed by "rupees", "rs", "₹", or just numbers
- **Time Detection**: "now", "today", "yesterday", "9:30 AM", "9:30pm", "morning", "evening"
- **Account Detection**: "federal bank", "Federal account", "cash", "liquid money"
- **Purpose Detection**: "fruits", "bus charge", "train", "loan", "fitness", "food"
- **Person Detection**: Names for lending/borrowing
- **Route Detection**: "TVM to TIR", "Mumbai to Delhi", "Home to Office"
- **Payment Method**: "cash", "liquid money", "card", "UPI", "bank transfer"

**ACCOUNT ID EXTRACTION (CRITICAL):**
- AVAILABLE ACCOUNTS entries look like: \`<UUID>: Account Name — description\`
- When you identify an account from context (e.g. "Federal Bank" in an SMS), find the matching entry and return ONLY the UUID part (before the first ":"): never return the account name
- Example: if the list has \`1222f224-...: Federal Bank — My account\` and SMS mentions "Federal Bank", return \`"account": "1222f224-..."\`

**UPI / DIGITAL PAYMENT TYPE RULES:**
- UPI payment sent TO a VPA address (e.g. name@hdfcbank, name@okicici) = EXPENSE (paying a merchant or person)
- UPI/bank transfer BETWEEN your own two accounts = TRANSFER
- "Rs X debited/sent via UPI to <name/VPA>" = EXPENSE, toAccount = ""
- "Rs X withdrawn@ ATM" = TRANSFER (bank → cash/wallet account)
- When type is "expense" or "income", toAccount MUST be ""

**USER CONTEXT NOTE:**
- If additional free-text appears after the SMS (e.g. "Coffee breakfast", "groceries"), it is the user's own description of the PURPOSE — it takes priority as the title source
- title = user's description + payee if useful, e.g. "Breakfast Coffee - Muthukumar V" or "Fruits"
- note = SMS technical details only: reference number, transaction ID, VPA address, bank helpline — NOT the user's description
- Example: SMS "Rs 29.00 sent via UPI … to MUTHUKUMAR V. Ref:611517226818" + user text "Coffee breakfast"
  → title = "Breakfast Coffee - Muthukumar V", note = "UPI to MUTHUKUMAR V. Ref: 611517226818"

**SMS PATTERNS:**

**PLUXEE (MEAL WALLET) SMS PATTERNS:**
- "Rs. X.XX spent from Pluxee Meal wallet" = EXPENSE
- "Your Pluxee Card has been successfully credited with Rs.XXXX" = INCOME
- "Your Pluxee Card has been credited with INR X.XX as a reversal" = INCOME
- Extract: amount, date, time, merchant name (ETERNAL LIM = Zomato, at SWIGGY)
- Category: food, groceries, dining, meal cards

**BANK UPI SMS PATTERNS:**
- "Rs XXXX.XX debited via UPI" = EXPENSE
- "Rs XXXX withdrawn@ LOCATION" = TRANSFER (Bank to Wallet - ATM withdrawal)
- "Your a/c debited for Rs.XXXXX and a/c XXXXXX credited" = TRANSFER
- Extract: amount, date, time, merchant (VPA), payment method, bank name
- Category: based on merchant (fitness, utilities, food, shopping, etc.)

**DATE AND TIME EXTRACTION:**
- Indian format: DD-MM-YYYY HH:MM:SS (convert to YYYY-MM-DD HH:MM:SS)
- Day format: "Tue Aug 12 2025" (convert to YYYY-08-12)
- Time format: 24-hour (12:52:23, 20:41:52)
- If no date found, use current user datetime
- If no time found, use 00:00:00

**AMOUNT EXTRACTION:**
- Look for "Rs. X.XX", "Rs XXXX.XX", "INR X.XX"
- Remove currency symbols and commas
- Return as a numeric string e.g. "500.00" (not a number)
- Ignore balance amounts (Avl bal Rs.XXXXX.XX)

**CATEGORY MAPPING:**
- **Fitness**: gym, boxing coaching, sports, fitness studio
- **Food**: Zomato, Swiggy, groceries, dining, fruits
- **Transportation**: bus, train, taxi, fuel, IRCTC, public transit
- **Utilities**: electricity, water, internet, mobile recharge
- **Shopping**: clothing, electronics, books
- **ATM**: "withdrawn@ LOCATION" = Bank to Wallet transfer
- **Loans**: lending money, borrowing, personal loans
- **Cash**: liquid money, physical cash

**EXAMPLES:**

Input: "Spend 100 rupees from federal bank for fruits now"
Output: amount=100, account=federal bank, type=expense, category=food, title="Fruits"

Input: "Gave 1000 rupees from Federal account to Shamil as loan at 9:30 AM"
Output: amount=1000, account=Federal, person=Shamil, type=expense, category=loans, title="Loan to Shamil"

Input: "Rs 6000.00 debited via UPI on 15-08-2025 20:41:52 to VPA hybridfitnessstudio@hdfcbank"
Output: amount=6000, date=2025-08-15 20:41:52, type=expense, category=fitness, title="Hybrid Fitness Studio"

Input: "Rs 2000 withdrawn@ POOKIPAR on 03AUG25 17:30"
Output: amount=2000, date=2025-08-03 17:30:00, type=transfer, title="ATM Withdrawal at POOKIPAR"

RESPONSE FORMAT (return only this JSON, no extra text):
{
  "title": "string",
  "amount": number,
  "category": "string",
  "tags": ["string"],
  "date": "string",
  "type": "string",
  "person": "string",
  "account": "string",
  "toAccount": "string",
  "note": "string"
}

CRITICAL RULES:
- Return valid JSON only — no markdown, no explanation, no extra text
- **title is REQUIRED** — never leave it empty; derive it from the merchant name, payee, purpose, or the input text itself
- **account MUST be the UUID** from AVAILABLE ACCOUNTS — the exact string before ":" (e.g. "1222f224-2b85-4b6e-..."), never the account name like "Federal Bank"
- Use IDs from the provided lists for category, tags, account, toAccount, person — the exact string shown before ":" in each list entry; never return a display name
- **UPI payments to VPA/merchant = expense** — only use "transfer" when moving between your own two accounts
- Amount must be a positive numeric string like "500.00"; ignore balance amounts; no currency symbols
- Date format: YYYY-MM-DD HH:MM:SS in user timezone
- type must be exactly: "income", "expense", or "transfer"
- For EXPENSE: toAccount = ""
- For INCOME: toAccount = "" (account = destination account where money arrives)
- For TRANSFER: both account and toAccount must be filled
- Default type: "expense"
- Use empty string "" for unknown string fields (except tags which uses [])
`.trim()
}

// ─── Image → Transaction ───────────────────────────────────────────────────────

export const IMAGE_TO_TRANSACTION_SYSTEM = `You are an expert financial transaction analyzer specializing in receipt analysis for a money management application. You must return only valid JSON in the exact format specified. Do not include any explanations or extra text.`

export function buildImageToTransactionPrompt(p: {
  categories: string
  tags: string
  accounts: string
  people: string
  timezone: string
  currentDatetime: string
}): string {
  return `
Analyze the provided receipt image and extract comprehensive transaction details. Return structured JSON data based on the receipt type and content.

AVAILABLE CATEGORIES (tree — pick a CHILD id from "- <id>: name — desc" lines; "### <type>" and "## <parent>" are context only, never return them):
${p.categories}

AVAILABLE TAGS (use ID only):
${p.tags}

AVAILABLE ACCOUNTS (use ID only):
${p.accounts}

AVAILABLE PEOPLE (use ID only):
${p.people}

CURRENT DATE AND TIME (User Timezone: ${p.timezone}):
${p.currentDatetime}

CATEGORY RULES (STRICT):
- The category type MUST match the transaction type exactly: expense→expense, income→income, transfer→transfer
- If no suitable category matches, use empty string ""

RECEIPT ANALYSIS RULES:

**GENERAL PRINCIPLES:**
- 95% of receipts are EXPENSE transactions
- For EXPENSE: toAccount must be null/empty
- For INCOME: account must be null/empty
- Use exact IDs from provided lists (not names)
- Format date as YYYY-MM-DD HH:MM:SS in user timezone
- Amount must be numeric (no currency symbols or commas)

**GOOGLE PAY RECEIPTS:**
- "Pay again" = EXPENSE (personal payment)
- "Payment Started" → "Pay intermediary" → "Bill payment proceed" = EXPENSE (utility bills)
- "Payments may take up to 3 working days" = INCOME (someone paid you)
- Extract: payment account, receiver name, amount, date, comment, time

**PHONEPE RECEIPTS:**
- "Debited from" account = EXPENSE
- "Credited to" account = INCOME
- If debited account not found, guess using bank logo

**RESTAURANT/SHOP RECEIPTS:**
- Extract: date, time, shop name, food items, total amount
- Payment method: cash, card, bank transfer, meal card
- SODEXO/Pluxee = meal card payment

**BILL PAYMENT RECEIPTS:**
- Utility bills (electricity, water, gas, internet, phone) = EXPENSE
- Insurance premiums = EXPENSE
- Credit card payments = EXPENSE
- Loan EMIs = EXPENSE

**BANK TRANSFER RECEIPTS:**
- Look for "TRANSFER" keyword
- Source account → Destination account
- type = "transfer"; both account and toAccount must be filled

RESPONSE FORMAT (return only this JSON, no extra text):
{
  "title": "string",
  "amount": number,
  "category": "string",
  "tags": ["string"],
  "date": "string",
  "type": "string",
  "person": "string",
  "account": "string",
  "toAccount": "string",
  "note": "string"
}

CRITICAL RULES:
- Return valid JSON only — no markdown, no explanation, no extra text
- **title is REQUIRED** — never leave it empty; use the shop/merchant name, payee name, or a brief description of what the receipt shows
- **account**: use the exact ID string (before ":") from AVAILABLE ACCOUNTS — never the account name; leave empty string if you cannot determine it
- Use IDs from the provided lists for category, tags, account, toAccount, person — the exact string shown before ":" in each list entry
- Amount must be a positive numeric string like "500.00"; no currency symbols or commas
- Date format: YYYY-MM-DD HH:MM:SS in user timezone
- type must be exactly: "income", "expense", or "transfer"
- For EXPENSE or INCOME: toAccount = ""
- For TRANSFER: both account and toAccount must be filled
- If receipt is unclear or unreadable, return an empty JSON object {}
- Default type: "expense"
- Use empty string "" for unknown string fields (except tags which uses [])
`.trim()
}

// ─── Category Suggestion ───────────────────────────────────────────────────────

export const CATEGORY_SUGGESTION_SYSTEM = `You are an expert at classifying financial transactions into categories for a money management application. Choose exactly one child category ID from the provided list that best matches the transaction. Return only valid JSON matching the schema. If nothing fits, return an empty string for categoryId.`

export function buildCategorySuggestionPrompt(p: {
  type: 'income' | 'expense' | 'transfer'
  title: string
  amount?: string
  date?: string
  note?: string
  personName?: string
  categories: string
}): string {
  const optional: string[] = []
  if (p.amount) optional.push(`- Amount: ${p.amount}`)
  if (p.date) optional.push(`- Date: ${p.date}`)
  if (p.note) optional.push(`- Note: ${p.note}`)
  if (p.personName) optional.push(`- Person: ${p.personName}`)
  const optionalBlock = optional.length ? `\nADDITIONAL CONTEXT:\n${optional.join('\n')}\n` : ''

  return `
Classify the transaction below into one of the provided child categories. All listed categories are already filtered to match the transaction type (${p.type}).

TRANSACTION:
- Type: ${p.type}
- Title: ${p.title}
${optionalBlock}
AVAILABLE CATEGORIES (grouped as "## ParentName — parent description" followed by child rows "- <id>: ChildName — child description"):
${p.categories}

RULES:
- Pick exactly ONE child-category ID (the value after "- " and before ":").
- Never return a parent/group header — those are context only.
- If nothing is a reasonable fit, return empty string "" for categoryId.
- Do not invent IDs. Do not output any text outside the JSON.

RESPONSE FORMAT (return only this JSON, no extra text):
{
  "categoryId": "string"
}
`.trim()
}
