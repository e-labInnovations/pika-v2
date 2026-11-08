import type { Payload } from 'payload'

import type { CapturedSm, User } from '@/payload-types'
import { confirmCapturedSms, dismissCapturedSms, type ConfirmOverrides } from '@/utilities/sms/confirm'
import { loadLookups, type LookupItem } from './transactions'

const idOf = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

/** The user's own bank SMS waiting for review, newest first (an admin sees only theirs too). */
export async function listPendingSms(payload: Payload, user: User): Promise<CapturedSm[]> {
  const res = await payload.find({
    collection: 'captured-sms',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'pending' } }] },
    sort: '-receivedAt',
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return res.docs as CapturedSm[]
}

async function own(payload: Payload, user: User, id: string): Promise<CapturedSm | null> {
  const sms = await payload.findByID({ collection: 'captured-sms', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  return sms && idOf(sms.user) === String(user.id) ? (sms as CapturedSm) : null
}

/** Confirms the user's own SMS, with their changes; every id must be theirs. */
export async function confirmOwnSms(payload: Payload, user: User, id: string, overrides: ConfirmOverrides): Promise<{ transaction: string } | { error: string }> {
  if (!overrides || typeof overrides !== 'object') return { error: 'Invalid changes.' }
  if (!(await own(payload, user, id))) return { error: 'SMS not found.' }
  for (const k of ['tags', 'shares', 'attachments', 'parts'] as const) {
    if (overrides[k] !== undefined && !Array.isArray(overrides[k])) return { error: 'Invalid changes.' }
  }
  const l = await loadLookups(payload, user)
  const has = (list: LookupItem[], v?: string | null) => !v || list.some((x) => x.id === v)
  if (!has(l.categories, overrides.category)) return { error: 'Choose one of your categories.' }
  if (!has(l.accounts, overrides.account) || !has(l.accounts, overrides.toAccount)) return { error: 'Choose one of your accounts.' }
  if (!has(l.people, overrides.person) || (overrides.shares ?? []).some((s) => !has(l.people, s.person))) return { error: 'Choose your own people.' }
  if ((overrides.tags ?? []).some((t) => !has(l.tags, t))) return { error: 'Choose your own tags.' }
  for (const p of overrides.parts ?? []) {
    if (!p || typeof p !== 'object' || !p.category || !has(l.categories, p.category)) return { error: 'Choose one of your categories for every part.' }
    if ((Array.isArray(p.tags) ? p.tags : []).some((t) => !has(l.tags, t)) || !has(l.people, p.person)) return { error: 'Choose your own tags and people.' }
  }
  if ((overrides.attachments ?? []).length) {
    const ids = overrides.attachments!.map(String)
    const media = await payload.find({ collection: 'media', where: { and: [{ user: { equals: user.id } }, { id: { in: ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)) } }] }, limit: ids.length, depth: 0, user, overrideAccess: false })
    if (media.docs.length !== new Set(ids).size) return { error: 'Attach only your own files.' }
  }
  try {
    const res = await confirmCapturedSms(payload, user, id, overrides)
    return { transaction: res.transaction }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not confirm.' }
  }
}

export async function dismissOwnSms(payload: Payload, user: User, id: string): Promise<{ ok: true } | { error: string }> {
  if (!(await own(payload, user, id))) return { error: 'SMS not found.' }
  try {
    await dismissCapturedSms(payload, user, id)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not dismiss.' }
  }
}
