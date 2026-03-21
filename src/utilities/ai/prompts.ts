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

AVAILABLE CATEGORIES (use ID only):
${p.categories}

AVAILABLE TAGS (use ID only):
${p.tags}

AVAILABLE ACCOUNTS (use ID only):
${p.accounts}

AVAILABLE PEOPLE (use ID only):
${p.people}

CURRENT DATE AND TIME (User Timezone: ${p.timezone}):
${p.currentDatetime}

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
- Convert to numeric value
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
- Return valid JSON only
- Use empty string "" for unknown fields (except tags which uses [])
- Use IDs from the provided lists for category, tags, account, toAccount, person
- Amount must be a positive number; ignore balance amounts
- Date format: YYYY-MM-DD HH:MM:SS in user timezone
- type must be exactly: "income", "expense", or "transfer"
- For EXPENSE: toAccount = ""
- For INCOME: account = ""
- For TRANSFER: both account and toAccount must be filled
- Default type: "expense"
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

AVAILABLE CATEGORIES (use ID only):
${p.categories}

AVAILABLE TAGS (use ID only):
${p.tags}

AVAILABLE ACCOUNTS (use ID only):
${p.accounts}

AVAILABLE PEOPLE (use ID only):
${p.people}

CURRENT DATE AND TIME (User Timezone: ${p.timezone}):
${p.currentDatetime}

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
- Return valid JSON only
- Use empty string "" for unknown fields (except tags which uses [])
- Use IDs from the provided lists
- Amount must be a positive number
- Date format: YYYY-MM-DD HH:MM:SS in user timezone
- type must be exactly: "income", "expense", or "transfer"
- For EXPENSE or INCOME: toAccount = ""
- For TRANSFER: both account and toAccount must be filled
- If receipt is unclear or unreadable, return an empty JSON object {}
- Default type: "expense"
`.trim()
}
