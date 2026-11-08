import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export type WebSettings = {
  name: string
  email: string
  currency: string
  timezone: string
  defaultAccount: string | null
  preferredModel: string
  allowFallback: boolean
  categoryAiMethod: 'minilm' | 'cloud'
  aiNarrowPrompt: boolean
  smsAutoConfirm: boolean
  smsAutoConfirmMaxAmount: number
  smsReplyAction: 'add' | 'review'
  /** Only whether a key is stored; the key itself never leaves the server. */
  hasGeminiKey: boolean
  hasHfKey: boolean
  models: { id: string; name: string; provider: string }[]
}

export type SettingsInput = Partial<
  Omit<WebSettings, 'email' | 'hasGeminiKey' | 'hasHfKey' | 'models'> & {
    /** A new key; null clears it; undefined leaves it. */
    geminiApiKey: string | null
    hfApiKey: string | null
  }
>

const SETTING_KEYS = ['currency', 'timezone', 'defaultAccount', 'preferredModel', 'allowFallback', 'categoryAiMethod', 'aiNarrowPrompt', 'smsAutoConfirm', 'smsAutoConfirmMaxAmount', 'smsReplyAction'] as const
const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

async function settingsDoc(payload: Payload, user: User) {
  const res = await payload.find({ collection: 'user-settings', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true })
  return res.docs[0] as unknown as Record<string, unknown> | undefined
}

export async function loadSettings(payload: Payload, user: User): Promise<WebSettings> {
  const [s, app, fresh] = await Promise.all([
    settingsDoc(payload, user),
    payload.findGlobal({ slug: 'app-settings', depth: 0, overrideAccess: true }).catch(() => null),
    payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }).catch(() => user),
  ])
  const models = ((app as { models?: { id: string; name: string; provider: string; enabled?: boolean }[] } | null)?.models ?? [])
    .filter((m) => m.enabled !== false)
    .map(({ id, name, provider }) => ({ id, name, provider }))
  return {
    name: fresh.name ?? '',
    email: user.email,
    currency: String(s?.currency ?? 'INR'),
    timezone: String(s?.timezone ?? 'Asia/Calcutta'),
    defaultAccount: idOf(s?.defaultAccount),
    preferredModel: String(s?.preferredModel ?? ''),
    allowFallback: s?.allowFallback !== false,
    categoryAiMethod: s?.categoryAiMethod === 'cloud' ? 'cloud' : 'minilm',
    aiNarrowPrompt: s?.aiNarrowPrompt !== false,
    smsAutoConfirm: s?.smsAutoConfirm === true,
    smsAutoConfirmMaxAmount: Number(s?.smsAutoConfirmMaxAmount ?? 2000),
    smsReplyAction: s?.smsReplyAction === 'review' ? 'review' : 'add',
    hasGeminiKey: !!s?.geminiApiKey,
    hasHfKey: !!s?.hfApiKey,
    models,
  }
}

/** Saves the user's own settings (and profile name); validation is the collection's. */
export async function saveSettings(payload: Payload, user: User, input: SettingsInput): Promise<{ ok: true } | { error: string }> {
  if (!input || typeof input !== 'object') return { error: 'Invalid settings.' }
  const data: Record<string, unknown> = {}
  for (const k of SETTING_KEYS) if (input[k] !== undefined) data[k] = input[k]
  for (const k of ['geminiApiKey', 'hfApiKey', 'name'] as const) {
    if (input[k] !== undefined && input[k] !== null && typeof input[k] !== 'string') return { error: 'Invalid settings.' }
  }
  if (input.geminiApiKey !== undefined) data.geminiApiKey = input.geminiApiKey ? input.geminiApiKey.trim() : null
  if (input.hfApiKey !== undefined) data.hfApiKey = input.hfApiKey ? input.hfApiKey.trim() : null
  if (data.defaultAccount) {
    const acc = await payload.findByID({ collection: 'accounts', id: String(data.defaultAccount), depth: 0, user, overrideAccess: false }).catch(() => null)
    if (!acc || idOf(acc.user) !== String(user.id)) return { error: 'Choose one of your accounts.' }
  }
  try {
    if (input.name !== undefined) {
      if (!input.name.trim()) return { error: 'Name is required.' }
      await payload.update({ collection: 'users', id: user.id, data: { name: input.name.trim() } as never, user, overrideAccess: false, depth: 0 })
    }
    if (Object.keys(data).length) {
      const s = await settingsDoc(payload, user)
      if (s) await payload.update({ collection: 'user-settings', id: String(s.id), data: data as never, user, overrideAccess: false, depth: 0 })
      else await payload.create({ collection: 'user-settings', data: { ...data, user: user.id } as never, user, overrideAccess: false, depth: 0 })
    }
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
}
