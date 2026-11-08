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
  if (!(await own(payload, user, id))) return { error: 'SMS not found.' }
  const l = await loadLookups(payload, user)
  const has = (list: LookupItem[], v?: string | null) => !v || list.some((x) => x.id === v)
  if (!has(l.categories, overrides.category)) return { error: 'Choose one of your categories.' }
  if (!has(l.accounts, overrides.account) || !has(l.accounts, overrides.toAccount)) return { error: 'Choose one of your accounts.' }
  if (!has(l.people, overrides.person) || (overrides.shares ?? []).some((s) => !has(l.people, s.person))) return { error: 'Choose your own people.' }
  if ((overrides.tags ?? []).some((t) => !has(l.tags, t))) return { error: 'Choose your own tags.' }
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
