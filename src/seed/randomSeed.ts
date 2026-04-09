import type { Payload } from 'payload'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(n, arr.length))
}
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randAmount = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(2)

function randomDate(daysBack: number): string {
  const d = new Date()
  d.setDate(d.getDate() - rand(0, daysBack))
  return d.toISOString()
}

// ─── Default accounts ─────────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  { name: 'Wallet',      icon: 'wallet',   bgColor: '#16A34A', color: '#FFFFFF' },
  { name: 'Bank',        icon: 'building', bgColor: '#2563EB', color: '#FFFFFF' },
  { name: 'Savings',     icon: 'piggy-bank', bgColor: '#9333EA', color: '#FFFFFF' },
]

// ─── Static pools ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aisha', 'Arjun', 'Divya', 'Farhan', 'Geeta', 'Harish', 'Indira', 'Jay',
  'Kavya', 'Lakshmi', 'Mohan', 'Nisha', 'Omar', 'Pooja', 'Ravi', 'Sana',
  'Tarun', 'Uma', 'Vikram', 'Zara', 'Anil', 'Bhavna', 'Chetan', 'Deepa',
]
const LAST_NAMES = [
  'Sharma', 'Patel', 'Nair', 'Iyer', 'Reddy', 'Mehta', 'Joshi', 'Singh',
  'Kumar', 'Verma', 'Gupta', 'Desai', 'Shah', 'Khan', 'Pillai', 'Rao',
]


const TAG_POOL = [
  { name: 'Subscription', icon: 'repeat', color: '#FFFFFF', bgColor: '#3182CE' },
  { name: 'One-time', icon: 'zap', color: '#FFFFFF', bgColor: '#D69E2E' },
  { name: 'Weekend', icon: 'sun', color: '#FFFFFF', bgColor: '#ED8936' },
  { name: 'Work', icon: 'briefcase', color: '#FFFFFF', bgColor: '#2D3748' },
  { name: 'Essential', icon: 'star', color: '#FFFFFF', bgColor: '#2F855A' },
  { name: 'Luxury', icon: 'gem', color: '#FFFFFF', bgColor: '#9F7AEA' },
  { name: 'Family', icon: 'users', color: '#FFFFFF', bgColor: '#DD6B20' },
  { name: 'Health', icon: 'heart-pulse', color: '#FFFFFF', bgColor: '#E53E3E' },
  { name: 'Investment', icon: 'trending-up', color: '#FFFFFF', bgColor: '#38A169' },
  { name: 'Travel', icon: 'plane', color: '#FFFFFF', bgColor: '#3182CE' },
]

const CATEGORY_POOL = {
  expense: [
    { name: 'Online Shopping', icon: 'shopping-cart', color: '#FFFFFF', bgColor: '#D53F8C', description: 'E-commerce purchases' },
    { name: 'Subscriptions', icon: 'repeat', color: '#FFFFFF', bgColor: '#3182CE', description: 'Streaming and software subscriptions' },
    { name: 'Takeaway', icon: 'package', color: '#FFFFFF', bgColor: '#DD6B20', description: 'Food delivery orders' },
    { name: 'Pet Care', icon: 'paw-print', color: '#FFFFFF', bgColor: '#68D391', description: 'Pet food and vet bills' },
    { name: 'Hobbies', icon: 'palette', color: '#FFFFFF', bgColor: '#9F7AEA', description: 'Hobby and craft supplies' },
    { name: 'Parking & Tolls', icon: 'circle-parking', color: '#FFFFFF', bgColor: '#4A5568', description: 'Parking and road tolls' },
    { name: 'Insurance', icon: 'shield-check', color: '#FFFFFF', bgColor: '#2C5282', description: 'Insurance premiums' },
    { name: 'Laundry', icon: 'shirt', color: '#FFFFFF', bgColor: '#319795', description: 'Laundry and dry cleaning' },
    { name: 'Stationery', icon: 'pencil', color: '#FFFFFF', bgColor: '#B7791F', description: 'Office and stationery supplies' },
    { name: 'Charity', icon: 'hand-heart', color: '#FFFFFF', bgColor: '#E53E3E', description: 'Donations and charity' },
  ],
  income: [
    { name: 'Side Project', icon: 'code', color: '#FFFFFF', bgColor: '#3182CE', description: 'Income from side projects' },
    { name: 'Rental Income', icon: 'home', color: '#FFFFFF', bgColor: '#38A169', description: 'Property rental earnings' },
    { name: 'Cash Back', icon: 'coins', color: '#FFFFFF', bgColor: '#D69E2E', description: 'Credit card or app cashback' },
    { name: 'Gift Received', icon: 'gift', color: '#FFFFFF', bgColor: '#ED64A6', description: 'Money received as gifts' },
    { name: 'Tax Refund', icon: 'receipt', color: '#FFFFFF', bgColor: '#2D3748', description: 'Income tax refund' },
  ],
  transfer: [
    { name: 'Savings', icon: 'piggy-bank', color: '#FFFFFF', bgColor: '#2F855A', description: 'Transfer to savings account' },
    { name: 'Bill Payment', icon: 'file-text', color: '#FFFFFF', bgColor: '#4299E1', description: 'Online bill payments' },
    { name: 'UPI Transfer', icon: 'smartphone', color: '#FFFFFF', bgColor: '#553C9A', description: 'UPI fund transfers' },
  ],
}

const TRANSACTION_TEMPLATES = {
  expense: [
    { title: 'Grocery run', amountRange: [300, 2500] as [number, number] },
    { title: 'Lunch at restaurant', amountRange: [150, 800] as [number, number] },
    { title: 'Uber ride', amountRange: [80, 450] as [number, number] },
    { title: 'Mobile recharge', amountRange: [199, 999] as [number, number] },
    { title: 'Electricity bill', amountRange: [800, 4000] as [number, number] },
    { title: 'Coffee & snacks', amountRange: [60, 350] as [number, number] },
    { title: 'Movie tickets', amountRange: [400, 1200] as [number, number] },
    { title: 'Pharmacy', amountRange: [150, 2000] as [number, number] },
    { title: 'Petrol refill', amountRange: [500, 3000] as [number, number] },
    { title: 'Online shopping', amountRange: [299, 8000] as [number, number] },
    { title: 'Gym membership', amountRange: [800, 3500] as [number, number] },
    { title: 'Netflix subscription', amountRange: [149, 649] as [number, number] },
    { title: 'Zomato order', amountRange: [200, 900] as [number, number] },
    { title: 'Water bill', amountRange: [150, 600] as [number, number] },
    { title: 'Haircut', amountRange: [100, 600] as [number, number] },
    { title: 'Weekend outing', amountRange: [500, 3000] as [number, number] },
    { title: 'Clothing purchase', amountRange: [500, 6000] as [number, number] },
    { title: 'Internet bill', amountRange: [399, 1499] as [number, number] },
    { title: 'Doctor visit', amountRange: [300, 2500] as [number, number] },
    { title: 'Book purchase', amountRange: [150, 1200] as [number, number] },
  ],
  income: [
    { title: 'Monthly salary', amountRange: [30000, 150000] as [number, number] },
    { title: 'Freelance payment', amountRange: [5000, 50000] as [number, number] },
    { title: 'Performance bonus', amountRange: [5000, 30000] as [number, number] },
    { title: 'Cashback credit', amountRange: [50, 500] as [number, number] },
    { title: 'Interest earned', amountRange: [100, 2000] as [number, number] },
    { title: 'Gift money', amountRange: [500, 5000] as [number, number] },
    { title: 'Dividend received', amountRange: [200, 5000] as [number, number] },
    { title: 'Tax refund', amountRange: [1000, 15000] as [number, number] },
  ],
  transfer: [
    { title: 'Transfer to savings', amountRange: [2000, 30000] as [number, number] },
    { title: 'ATM withdrawal', amountRange: [1000, 10000] as [number, number] },
    { title: 'Rent payment', amountRange: [8000, 35000] as [number, number] },
    { title: 'Credit card payment', amountRange: [3000, 25000] as [number, number] },
    { title: 'UPI transfer', amountRange: [500, 15000] as [number, number] },
  ],
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const seedRandomData = async (
  payload: Payload,
  userId: string,
  options: { people: number; transactions: number } = { people: 6, transactions: 30 },
) => {
  const log: string[] = []

  // ── 0. Fetch the user document (needed to satisfy filterOptions checks) ──
  const userDoc = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    context: { internal: true },
  })

  // ── 1. Load user's accounts ──────────────────────────────────────────────
  const accountsResult = await payload.find({
    collection: 'accounts',
    where: { user: { equals: userId } },
    limit: 20,
    depth: 0,
    context: { internal: true },
  })
  const accounts = accountsResult.docs

  if (accounts.length === 0) {
    for (const acct of DEFAULT_ACCOUNTS) {
      const created = await payload.create({
        collection: 'accounts',
        data: { ...acct, user: userId, isActive: true },
        context: { internal: true },
      })
      accounts.push(created)
    }
    log.push(`🏦 Created ${accounts.length} default accounts`)
  }

  // ── 2. Load existing system categories & tags ────────────────────────────
  // Only child categories (parent !== null) are valid for transactions
  const systemCats = await payload.find({
    collection: 'categories',
    where: {
      and: [
        { user: { not_equals: userId } },
        { parent: { exists: true } },
      ],
    },
    limit: 100,
    depth: 0,
    context: { internal: true },
  })
  const existingCats = systemCats.docs

  const systemTags = await payload.find({
    collection: 'tags',
    where: { user: { not_equals: userId } },
    limit: 50,
    depth: 0,
    context: { internal: true },
  })
  const existingTags = systemTags.docs

  // ── 3. Create people ─────────────────────────────────────────────────────
  const createdPeople: string[] = []
  for (let i = 0; i < options.people; i++) {
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    const name = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(10, 99)}@example.com`
    const phone = `+91 ${rand(70000, 99999)} ${rand(10000, 99999)}`

    try {
      const p = await payload.create({
        collection: 'people',
        data: { name, email, phone, user: userId, isActive: true },
        overrideAccess: true,
        context: { internal: true },
      })
      createdPeople.push(p.id as string)
    } catch {
      // skip duplicates
    }
  }
  log.push(`👤 Created ${createdPeople.length} people`)

  // ── 4. Create user tags ──────────────────────────────────────────────────
  const tagPool = pickN(TAG_POOL, rand(5, TAG_POOL.length))
  const createdTags: string[] = []
  for (const t of tagPool) {
    try {
      const tag = await payload.create({
        collection: 'tags',
        data: { ...t, user: userId, isActive: true },
        context: { internal: true },
      })
      createdTags.push(tag.id as string)
    } catch {
      // skip duplicates
    }
  }
  const allTagIds = [
    ...createdTags,
    ...existingTags.map((t) => t.id as string),
  ]
  log.push(`🏷️  Created ${createdTags.length} tags`)

  // ── 5. Create user categories ────────────────────────────────────────────
  const createdCategoryIds: { expense: string[]; income: string[]; transfer: string[] } = {
    expense: [],
    income: [],
    transfer: [],
  }

  for (const type of ['expense', 'income', 'transfer'] as const) {
    const pool = CATEGORY_POOL[type]
    const selected = pickN(pool, rand(2, pool.length))
    if (selected.length === 0) continue

    // Create a parent "Custom" category, then attach all selected as children
    const parentIconMap = { expense: 'tag', income: 'trending-up', transfer: 'arrow-right-left' }
    const parentColorMap = { expense: '#E53E3E', income: '#38A169', transfer: '#319795' }
    try {
      const parent = await payload.create({
        collection: 'categories',
        data: {
          name: 'Custom',
          icon: parentIconMap[type],
          color: '#FFFFFF',
          bgColor: parentColorMap[type],
          type,
          description: `Custom ${type} categories`,
          user: userId,
          isActive: true,
          parent: null,
        },
        context: { internal: true },
      })
      for (const c of selected) {
        try {
          const cat = await payload.create({
            collection: 'categories',
            data: { ...c, type, user: userId, isActive: true, parent: parent.id as string },
            context: { internal: true },
          })
          createdCategoryIds[type].push(cat.id as string)
        } catch {
          // skip
        }
      }
    } catch {
      // skip if parent creation fails
    }
  }

  // Merge with system child categories per type
  const allCatIds = {
    expense: [
      ...createdCategoryIds.expense,
      ...existingCats.filter((c) => c.type === 'expense').map((c) => c.id as string),
    ],
    income: [
      ...createdCategoryIds.income,
      ...existingCats.filter((c) => c.type === 'income').map((c) => c.id as string),
    ],
    transfer: [
      ...createdCategoryIds.transfer,
      ...existingCats.filter((c) => c.type === 'transfer').map((c) => c.id as string),
    ],
  }

  const totalCats =
    createdCategoryIds.expense.length +
    createdCategoryIds.income.length +
    createdCategoryIds.transfer.length
  log.push(`📂 Created ${totalCats} categories`)

  // ── 6. Create transactions ───────────────────────────────────────────────
  const types: ('expense' | 'income' | 'transfer')[] = ['expense', 'expense', 'expense', 'income', 'transfer']
  let txCount = 0
  let firstError: string | null = null

  for (let i = 0; i < options.transactions; i++) {
    const type = pick(types)
    const templates = TRANSACTION_TEMPLATES[type]
    const template = pick(templates)
    const amount = randAmount(template.amountRange[0], template.amountRange[1])

    const account = pick(accounts)
    let toAccount: string | undefined
    if (type === 'transfer') {
      const others = accounts.filter((a) => a.id !== account.id)
      if (others.length > 0) toAccount = pick(others).id as string
      else continue // skip if only one account
    }

    // Category: 80% chance of having one
    let category: string | undefined
    if (Math.random() < 0.8 && allCatIds[type].length > 0) {
      category = pick(allCatIds[type])
    }

    // Tags: 60% chance, 1–3 tags
    let tags: string[] = []
    if (Math.random() < 0.6 && allTagIds.length > 0) {
      tags = pickN(allTagIds, rand(1, 3))
    }

    // Person: 30% chance (not for transfers)
    let person: string | undefined
    if (type !== 'transfer' && Math.random() < 0.3 && createdPeople.length > 0) {
      person = pick(createdPeople)
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txData: Record<string, any> = {
        title: template.title,
        amount,
        date: randomDate(90),
        type,
        account: account.id as string,
        user: userId,
      }
      if (toAccount) txData.toAccount = toAccount
      if (category) txData.category = category
      if (tags.length > 0) txData.tags = tags
      if (person) txData.person = person

      await payload.create({
        collection: 'transactions',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: txData as any,
        user: userDoc,
        overrideAccess: true,
        context: { internal: true },
      })
      txCount++
    } catch (err) {
      if (!firstError) firstError = err instanceof Error ? err.message : String(err)
    }
  }
  if (firstError) log.push(`⚠️ First tx error: ${firstError}`)
  log.push(`💸 Created ${txCount} transactions`)

  return log
}
