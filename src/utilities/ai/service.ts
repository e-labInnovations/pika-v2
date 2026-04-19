import type { Payload } from 'payload'
import { APIError } from 'payload'
import type { Category } from '../../payload-types'
import {
  callGeminiText,
  callGeminiImage,
  CATEGORY_SUGGESTION_RESPONSE_SCHEMA,
  type GeminiUsage,
} from './gemini'
import {
  TEXT_TO_TRANSACTION_SYSTEM,
  IMAGE_TO_TRANSACTION_SYSTEM,
  CATEGORY_SUGGESTION_SYSTEM,
  buildTextToTransactionPrompt,
  buildImageToTransactionPrompt,
  buildCategorySuggestionPrompt,
} from './prompts'
import { translateGeminiError } from './errors'
import {
  predictCategoryWithEmbeddings,
  resolveUserCategoryMethod,
  SCORE_THRESHOLD,
} from './minilm'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIConfig = {
  enabled: boolean
  apiKey: string
  apiKeyType: 'user' | 'app'
  defaultModel: string
  allowedModels: string[]
  perUserDailyLimit: number
  perUserMonthlyLimit: number
}

export type AITransactionResult = {
  data: Record<string, unknown>
  model: string
  latencyMs: number
  usage: GeminiUsage
}

export type AICategorySuggestionResult = {
  category: Category | null
  reason: string
  model: string
  latencyMs: number
  usage: GeminiUsage
}

export type TxType = 'income' | 'expense' | 'transfer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function resolveAIConfig(payload: Payload, userId: string): Promise<AIConfig> {
  const [appSettingsResult, userSettingsResult] = await Promise.all([
    (payload as any).findGlobal({ slug: 'app-settings', depth: 0, context: { internal: true } }),
    payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      context: { internal: true },
    }),
  ])

  const appAI = appSettingsResult?.ai ?? {}
  const userKey = (userSettingsResult.docs[0] as any)?.geminiApiKey as string | undefined
  const allowUserKey: boolean = appAI.allowUserApiKey !== false

  return {
    enabled: appAI.enabled !== false,
    apiKey: allowUserKey && userKey ? userKey : (appAI.geminiApiKey ?? ''),
    apiKeyType: allowUserKey && userKey ? 'user' : 'app',
    defaultModel: appAI.defaultModel || 'gemini-2.5-flash',
    allowedModels: ((appAI.models as any[]) ?? []).map((m: any) => m?.name as string).filter(Boolean),
    perUserDailyLimit: appAI.perUserDailyLimit ?? 20,
    perUserMonthlyLimit: appAI.perUserMonthlyLimit ?? 200,
  }
}

export function resolveModel(
  requested: string | undefined | null,
  config: Pick<AIConfig, 'defaultModel' | 'allowedModels'>,
): { model: string; error?: string } {
  const model = requested?.trim() || config.defaultModel
  if (config.allowedModels.length > 0 && !config.allowedModels.includes(model)) {
    return {
      model,
      error: `Model "${model}" is not allowed. Allowed: ${config.allowedModels.join(', ')}`,
    }
  }
  return { model }
}

export async function checkRateLimits(
  payload: Payload,
  userId: string,
  daily: number,
  monthly: number,
): Promise<void> {
  if (daily <= 0 && monthly <= 0) return

  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))

  // Per-user quota applies ONLY to Gemini calls that consumed the app's API
  // key. User-key calls are the user's own quota; local (MiniLM) calls don't
  // hit any external service. Both are excluded by the apiKeyType filter.
  const baseWhere = {
    user: { equals: userId },
    status: { equals: 'success' },
    apiKeyType: { equals: 'app' },
  }

  const [dailyResult, monthlyResult] = await Promise.all([
    daily > 0
      ? payload.find({
          collection: 'ai-usages',
          where: { and: [baseWhere, { createdAt: { greater_than_equal: dayStart.toISOString() } }] },
          limit: 0, pagination: false, depth: 0,
        })
      : Promise.resolve({ totalDocs: 0 }),
    monthly > 0
      ? payload.find({
          collection: 'ai-usages',
          where: { and: [baseWhere, { createdAt: { greater_than_equal: monthStart.toISOString() } }] },
          limit: 0, pagination: false, depth: 0,
        })
      : Promise.resolve({ totalDocs: 0 }),
  ])

  if (daily > 0 && dailyResult.totalDocs >= daily)
    throw new APIError(`Daily AI limit of ${daily} requests reached`, 429, null, true)
  if (monthly > 0 && monthlyResult.totalDocs >= monthly)
    throw new APIError(`Monthly AI limit of ${monthly} requests reached`, 429, null, true)
}

export async function buildUserContext(
  payload: Payload,
  userId: string,
): Promise<{ categories: string; tags: string; accounts: string; people: string }> {
  const sysResult = await payload.find({ collection: 'users', where: { role: { equals: 'system' } }, limit: 100, depth: 0 })
  const sysIds = sysResult.docs.map((u) => u.id)
  const ownerOr = [{ user: { equals: userId } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])]

  const [cats, tags, accounts, people] = await Promise.all([
    payload.find({ collection: 'categories', where: { and: [{ isActive: { equals: true } }, { or: ownerOr }] }, limit: 500, depth: 0 }),
    payload.find({ collection: 'tags', where: { and: [{ isActive: { equals: true } }, { or: ownerOr }] }, limit: 500, depth: 0 }),
    payload.find({ collection: 'accounts', where: { and: [{ isActive: { equals: true } }, { user: { equals: userId } }] }, limit: 200, depth: 0 }),
    payload.find({ collection: 'people', where: { and: [{ isActive: { equals: true } }, { user: { equals: userId } }] }, limit: 200, depth: 0 }),
  ])

  const fmt = (docs: any[], fields: string[]) =>
    docs.map((d) => `${d.id}: ${fields.map((f) => d[f]).filter(Boolean).join(' — ')}`).join('\n') || 'none'

  // Categories are grouped by type → parent → children so the parent name and
  // description appear ONCE per group (fewer tokens) and the tree structure
  // gives the model strong semantic context. See also
  // buildFilteredCategoriesForSuggestion (same idea, single-type variant).
  const categoriesStr = renderCategoryTree(cats.docs as Category[], { includeType: true }) || 'none'

  return {
    categories: categoriesStr,
    // Descriptions add the semantic context the model needs to disambiguate
    // similarly-named entries; when the field is empty the `filter(Boolean)`
    // in `fmt` drops the trailing " — " so there's no token waste.
    tags: fmt(tags.docs, ['name', 'description']),
    accounts: fmt(accounts.docs, ['name', 'description']),
    // Email + phone are especially useful for SMS parsing where the sender
    // may appear by number/email in the message text.
    people: fmt(people.docs, ['name', 'email', 'phone', 'description']),
  }
}

/**
 * Render Categories as a hierarchical tree for LLM prompts.
 *
 *   ### expense                        <- only when includeType=true
 *   ## Food & Dining — Eating out
 *   - <id>: Coffee & Snacks — Coffee shops
 *   - <id>: Groceries
 *
 *   ## Transportation
 *   - <id>: Fuel
 *
 * Emits only groups that have at least one child (the model picks child IDs).
 * Orphan children whose parent isn't in the list land under `## Other`.
 */
function renderCategoryTree(
  cats: Category[],
  opts: { includeType?: boolean } = {},
): string {
  type CatRow = {
    id: string
    name: string
    description: string
    parent: string | null
    type: TxType
  }

  const rows: CatRow[] = cats.map((c) => {
    const parentRef = c.parent
    const parentId =
      typeof parentRef === 'string'
        ? parentRef
        : parentRef && typeof parentRef === 'object'
          ? (parentRef as Category).id
          : null
    return {
      id: c.id,
      name: c.name ?? '',
      description: c.description ?? '',
      parent: parentId,
      type: (c.type ?? 'expense') as TxType,
    }
  })

  // Partition by type (needed when includeType=true; harmless otherwise).
  const typeOrder: TxType[] = ['expense', 'income', 'transfer']
  const rowsByType = new Map<TxType, CatRow[]>()
  for (const r of rows) {
    const arr = rowsByType.get(r.type) ?? []
    arr.push(r)
    rowsByType.set(r.type, arr)
  }

  const renderForRows = (typeRows: CatRow[]): string[] => {
    const parents = new Map<string, CatRow>()
    const childrenByParent = new Map<string, CatRow[]>()
    for (const r of typeRows) {
      if (!r.parent) {
        parents.set(r.id, r)
      } else {
        const arr = childrenByParent.get(r.parent) ?? []
        arr.push(r)
        childrenByParent.set(r.parent, arr)
      }
    }

    const out: string[] = []
    for (const [parentId, parent] of parents) {
      const children = childrenByParent.get(parentId) ?? []
      if (children.length === 0) continue
      const header = parent.description
        ? `## ${parent.name} — ${parent.description}`
        : `## ${parent.name}`
      const lines = children.map((c) =>
        c.description ? `- ${c.id}: ${c.name} — ${c.description}` : `- ${c.id}: ${c.name}`,
      )
      out.push([header, ...lines].join('\n'))
    }

    const orphans = typeRows.filter((r) => r.parent && !parents.has(r.parent))
    if (orphans.length > 0) {
      const lines = orphans.map((c) =>
        c.description ? `- ${c.id}: ${c.name} — ${c.description}` : `- ${c.id}: ${c.name}`,
      )
      out.push(['## Other', ...lines].join('\n'))
    }
    return out
  }

  if (!opts.includeType) {
    const all = Array.from(rowsByType.values()).flat()
    return renderForRows(all).join('\n\n')
  }

  const sections: string[] = []
  for (const t of typeOrder) {
    const typeRows = rowsByType.get(t) ?? []
    if (typeRows.length === 0) continue
    const groups = renderForRows(typeRows)
    if (groups.length === 0) continue
    sections.push(`### ${t}\n\n${groups.join('\n\n')}`)
  }
  return sections.join('\n\n')
}

export async function logUsage(
  payload: Payload,
  userId: string,
  params: {
    promptType: 'text' | 'image' | 'category-suggestion' | 'category-prediction'
    model: string
    /**
     * 'user' — the user's own Gemini API key (doesn't count against app quota)
     * 'app'  — the app's Gemini API key (counts against per-user app quota)
     * 'local'— no external API (MiniLM, doesn't count against any quota)
     */
    apiKeyType: 'user' | 'app' | 'local'
    status: 'success' | 'error'
    usage?: GeminiUsage
    latencyMs?: number
    error?: string
  },
): Promise<void> {
  try {
    await payload.create({
      collection: 'ai-usages',
      data: {
        user: userId,
        promptType: params.promptType,
        model: params.model,
        apiKeyType: params.apiKeyType,
        status: params.status,
        promptTokens: params.usage?.promptTokenCount ?? 0,
        candidateTokens: params.usage?.candidatesTokenCount ?? 0,
        totalTokens: params.usage?.totalTokenCount ?? 0,
        latencyMs: params.latencyMs ?? 0,
        error: params.error ?? null,
      },
      overrideAccess: true,
    })
  } catch { /* non-critical */ }
}

function getLocalDatetime(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace('T', ' ')
}

async function getUserTimezone(payload: Payload, userId: string): Promise<string> {
  try {
    const s = await payload.find({
      collection: 'user-settings',
      where: { user: { equals: userId } },
      limit: 1, depth: 0,
      context: { internal: true },
    })
    return (s.docs[0] as any)?.timezone || 'UTC'
  } catch { return 'UTC' }
}

// ─── ID → full object resolver ────────────────────────────────────────────────

async function resolveAITransactionData(
  payload: Payload,
  userId: string,
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const categoryId = typeof raw.category === 'string' && raw.category ? raw.category : null
  const accountId  = typeof raw.account  === 'string' && raw.account  ? raw.account  : null
  const toAccountId = typeof raw.toAccount === 'string' && raw.toAccount ? raw.toAccount : null
  const personId   = typeof raw.person   === 'string' && raw.person   ? raw.person   : null
  const tagIds: string[] = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string' && !!t)
    : []

  const accessOpts = { overrideAccess: true, depth: 0 }

  const txType = typeof raw.type === 'string' ? raw.type : null

  const [categoryResolved, account, toAccount, person, tags] = await Promise.all([
    categoryId
      ? payload.findByID({ collection: 'categories', id: categoryId, ...accessOpts }).catch(() => null)
      : Promise.resolve(null),
    accountId
      ? payload.findByID({ collection: 'accounts', id: accountId, ...accessOpts }).catch(() => null)
      : Promise.resolve(null),
    toAccountId
      ? payload.findByID({ collection: 'accounts', id: toAccountId, ...accessOpts }).catch(() => null)
      : Promise.resolve(null),
    personId
      ? payload.findByID({ collection: 'people', id: personId, ...accessOpts }).catch(() => null)
      : Promise.resolve(null),
    tagIds.length
      ? payload
          .find({ collection: 'tags', where: { id: { in: tagIds } }, limit: tagIds.length, ...accessOpts })
          .then((r) => r.docs)
          .catch(() => [] as any[])
      : Promise.resolve([] as any[]),
  ])

  // Validate category: must be a child category and match the transaction type
  const category = (() => {
    if (!categoryResolved) return null
    const cat = categoryResolved as Category
    const hasParent = !!cat.parent
    const typeMatches = !txType || cat.type === txType
    return hasParent && typeMatches ? cat : null
  })()

  return {
    ...raw,
    category: category ?? null,
    account:  account  ?? null,
    toAccount: toAccount ?? null,
    person:   person   ?? null,
    tags,
  }
}

// ─── Core processors ──────────────────────────────────────────────────────────

export async function processTextToTransaction(
  payload: Payload,
  userId: string,
  text: string,
  requestedModel?: string | null,
): Promise<AITransactionResult> {
  const config = await resolveAIConfig(payload, userId)

  if (!config.enabled) throw new APIError('AI features are disabled', 403, null, true)
  if (!config.apiKey) throw new APIError('No Gemini API key configured', 400, null, true)

  const { model, error: modelError } = resolveModel(requestedModel, config)
  if (modelError) throw new APIError(modelError, 400, null, true)

  // Per-user app quota only applies when the app's Gemini key is in use.
  // Users with their own key manage their own quota.
  if (config.apiKeyType === 'app') {
    await checkRateLimits(payload, userId, config.perUserDailyLimit, config.perUserMonthlyLimit)
  }

  const [timezone, context] = await Promise.all([
    getUserTimezone(payload, userId),
    buildUserContext(payload, userId),
  ])

  const userPrompt = buildTextToTransactionPrompt({ text, ...context, timezone, currentDatetime: getLocalDatetime(timezone) })

  let result
  try {
    result = await callGeminiText({ apiKey: config.apiKey, model, systemPrompt: TEXT_TO_TRANSACTION_SYSTEM, userPrompt })
  } catch (e: any) {
    await logUsage(payload, userId, { promptType: 'text', model, apiKeyType: config.apiKeyType, status: 'error', error: e.message })
    throw translateGeminiError(e) ?? e
  }

  await logUsage(payload, userId, { promptType: 'text', model, apiKeyType: config.apiKeyType, status: 'success', usage: result.usage, latencyMs: result.latencyMs })

  const resolved = await resolveAITransactionData(payload, userId, result.data)
  return { data: resolved, model, usage: result.usage, latencyMs: result.latencyMs }
}

export async function processImageToTransaction(
  payload: Payload,
  userId: string,
  imageBase64: string,
  mimeType: string,
  requestedModel?: string | null,
): Promise<AITransactionResult> {
  const config = await resolveAIConfig(payload, userId)

  if (!config.enabled) throw new APIError('AI features are disabled', 403, null, true)
  if (!config.apiKey) throw new APIError('No Gemini API key configured', 400, null, true)

  const { model, error: modelError } = resolveModel(requestedModel, config)
  if (modelError) throw new APIError(modelError, 400, null, true)

  // Per-user app quota only applies when the app's Gemini key is in use.
  // Users with their own key manage their own quota.
  if (config.apiKeyType === 'app') {
    await checkRateLimits(payload, userId, config.perUserDailyLimit, config.perUserMonthlyLimit)
  }

  const [timezone, context] = await Promise.all([
    getUserTimezone(payload, userId),
    buildUserContext(payload, userId),
  ])

  const userPrompt = buildImageToTransactionPrompt({ ...context, timezone, currentDatetime: getLocalDatetime(timezone) })

  let result
  try {
    result = await callGeminiImage({ apiKey: config.apiKey, model, systemPrompt: IMAGE_TO_TRANSACTION_SYSTEM, userPrompt, imageBase64, mimeType })
  } catch (e: any) {
    await logUsage(payload, userId, { promptType: 'image', model, apiKeyType: config.apiKeyType, status: 'error', error: e.message })
    throw translateGeminiError(e) ?? e
  }

  await logUsage(payload, userId, { promptType: 'image', model, apiKeyType: config.apiKeyType, status: 'success', usage: result.usage, latencyMs: result.latencyMs })

  const resolved = await resolveAITransactionData(payload, userId, result.data)
  return { data: resolved, model, usage: result.usage, latencyMs: result.latencyMs }
}

// ─── Category suggestion ──────────────────────────────────────────────────────

/**
 * MiniLM-backed implementation of `processCategorySuggestion`. Shapes the
 * embedding result into an `AICategorySuggestionResult` so the REST/GraphQL
 * surface stays identical regardless of which backend ran.
 */
async function runLocalCategorySuggestion(
  payload: Payload,
  userId: string,
  args: { type: TxType; title: string },
): Promise<AICategorySuggestionResult> {
  if (!args.title) throw new APIError('"title" is required', 400, null, true)

  let best: Awaited<ReturnType<typeof predictCategoryWithEmbeddings>> | null = null
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | undefined
  try {
    best = await predictCategoryWithEmbeddings(payload, userId, args)
  } catch (e: any) {
    status = 'error'
    errorMessage = e?.message ?? 'Prediction failed'
  }

  await logUsage(payload, userId, {
    promptType: 'category-suggestion',
    model: best?.model ?? 'Xenova/all-MiniLM-L6-v2',
    apiKeyType: 'local',
    status,
    latencyMs: best?.latencyMs ?? 0,
    error: errorMessage,
  })

  if (status === 'error')
    throw new APIError(errorMessage ?? 'Prediction failed', 500, null, true)

  const passes = !!best?.category && best.score >= SCORE_THRESHOLD
  return {
    category: passes ? best!.category : null,
    reason: passes
      ? `Matched locally (score ${(best!.score).toFixed(2)})`
      : 'No confident local match.',
    model: best?.model ?? 'Xenova/all-MiniLM-L6-v2',
    latencyMs: best?.latencyMs ?? 0,
    usage: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
  }
}

async function buildFilteredCategoriesForSuggestion(
  payload: Payload,
  userId: string,
  txType: TxType,
): Promise<string> {
  const sysResult = await payload.find({
    collection: 'users',
    where: { role: { equals: 'system' } },
    limit: 100,
    depth: 0,
  })
  const sysIds = sysResult.docs.map((u) => u.id)
  const ownerOr = [
    { user: { equals: userId } },
    ...(sysIds.length ? [{ user: { in: sysIds } }] : []),
  ]

  const cats = await payload.find({
    collection: 'categories',
    where: {
      and: [
        { isActive: { equals: true } },
        { type: { equals: txType } },
        { or: ownerOr },
      ],
    },
    limit: 500,
    depth: 0,
  })

  // Tree-structured render so the parent name/description appears ONCE per
  // group (fewer tokens than repeating `[parent: X]` on every child) and the
  // hierarchy gives the model strong semantic context. Categories here are
  // pre-filtered to a single type, so the `type` header isn't needed.
  return renderCategoryTree(cats.docs as Category[], { includeType: false }) || 'none'
}

async function resolvePersonName(
  payload: Payload,
  userId: string,
  personId: string,
): Promise<string | undefined> {
  try {
    const person = await payload.findByID({
      collection: 'people',
      id: personId,
      depth: 0,
      overrideAccess: true,
    })
    const ownerId = typeof (person as any).user === 'string' ? (person as any).user : (person as any).user?.id
    if (String(ownerId) !== String(userId)) return undefined
    return (person as any).name as string | undefined
  } catch {
    return undefined
  }
}

export async function processCategorySuggestion(
  payload: Payload,
  userId: string,
  args: {
    type: TxType
    title: string
    amount?: string
    date?: string
    note?: string
    personId?: string
    /**
     * Optional one-off override of the user's `categoryAiMethod` setting.
     * Used by the client's "Try with Gemini" fallback when the MiniLM path
     * doesn't produce a match — we want to call Gemini for that single
     * request without permanently flipping the user's preference.
     */
    forceMethod?: 'minilm' | 'gemini'
  },
  requestedModel?: string | null,
): Promise<AICategorySuggestionResult> {
  // Respect the user's preferred backend unless the caller overrode it.
  // MiniLM is free + local; Gemini is heavier and counts against quota.
  const method =
    args.forceMethod ?? (await resolveUserCategoryMethod(payload, userId))
  if (method === 'minilm') {
    return runLocalCategorySuggestion(payload, userId, {
      type: args.type,
      title: args.title.trim(),
    })
  }

  const config = await resolveAIConfig(payload, userId)

  if (!config.enabled) throw new APIError('AI features are disabled', 403, null, true)
  if (!config.apiKey) throw new APIError('No Gemini API key configured', 400, null, true)

  const { model, error: modelError } = resolveModel(requestedModel, config)
  if (modelError) throw new APIError(modelError, 400, null, true)

  // Per-user app quota only applies when the app's Gemini key is in use.
  // Users with their own key manage their own quota.
  if (config.apiKeyType === 'app') {
    await checkRateLimits(payload, userId, config.perUserDailyLimit, config.perUserMonthlyLimit)
  }

  const [categoriesStr, personName] = await Promise.all([
    buildFilteredCategoriesForSuggestion(payload, userId, args.type),
    args.personId ? resolvePersonName(payload, userId, args.personId) : Promise.resolve(undefined),
  ])

  const userPrompt = buildCategorySuggestionPrompt({
    type: args.type,
    title: args.title,
    amount: args.amount,
    date: args.date,
    note: args.note,
    personName,
    categories: categoriesStr,
  })

  let result
  try {
    result = await callGeminiText({
      apiKey: config.apiKey,
      model,
      systemPrompt: CATEGORY_SUGGESTION_SYSTEM,
      userPrompt,
      responseSchema: CATEGORY_SUGGESTION_RESPONSE_SCHEMA,
    })
  } catch (e: any) {
    await logUsage(payload, userId, {
      promptType: 'category-suggestion',
      model,
      apiKeyType: config.apiKeyType,
      status: 'error',
      error: e.message,
    })
    throw translateGeminiError(e) ?? e
  }

  await logUsage(payload, userId, {
    promptType: 'category-suggestion',
    model,
    apiKeyType: config.apiKeyType,
    status: 'success',
    usage: result.usage,
    latencyMs: result.latencyMs,
  })

  const raw = result.data
  const categoryId = typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : ''
  const reason = typeof raw.reason === 'string' ? raw.reason : ''

  let category: Category | null = null
  if (categoryId) {
    try {
      const fetched = (await payload.findByID({
        collection: 'categories',
        id: categoryId,
        depth: 1,
        overrideAccess: true,
      })) as Category
      const hasParent = !!fetched.parent
      const typeMatches = fetched.type === args.type
      // Owner-or-system validation: owner matches user, or owner is a system user
      const ownerId = typeof fetched.user === 'string' ? fetched.user : (fetched.user as any)?.id
      let ownerOk = String(ownerId) === String(userId)
      if (!ownerOk) {
        const sysResult = await payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        ownerOk = sysResult.docs.some((u) => String(u.id) === String(ownerId))
      }
      if (hasParent && typeMatches && ownerOk) category = fetched
    } catch {
      category = null
    }
  }

  return {
    category,
    reason,
    model,
    latencyMs: result.latencyMs,
    usage: result.usage,
  }
}
