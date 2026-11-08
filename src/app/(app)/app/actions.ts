'use server'

import { revalidatePath } from 'next/cache'

import { requireSession } from '@/lib/session'
import { formToEdit } from '@/lib/web/edit'
import { confirmOwnSms, dismissOwnSms } from '@/lib/web/sms'
import type { ConfirmOverrides } from '@/utilities/sms/confirm'
import { toPrefill, type Prefill } from '@/lib/web/prefill'
import { processImageToTransaction, processTextToTransaction } from '@/utilities/ai/service'
import { formatLocalDateTime, localInputValue } from '@/lib/web/format'
import { createTransaction, editTransaction, getOwnTransaction, loadLookups, splitOwnTransaction, suggestSplit, trashTransaction, type Duplicate, type PartIn } from '@/lib/web/transactions'

export type ActionState = { ok: string } | { error: string } | null

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : undefined)
/** share_person / share_amount pairs from the Split editor; undefined when it wasn't shown. */
const sharesOf = (form: FormData) => {
  if (!form.get('shares_present')) return undefined
  const people = form.getAll('share_person').map(String)
  const amounts = form.getAll('share_amount').map(String)
  return people.map((person, i) => ({ person, amount: amounts[i] ?? '' }))
}
const idOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null)

/** Edit form on the transaction panel: saves only the fields that changed. */
export async function saveTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user, timeZone } = await requireSession()
  const id = str(form.get('id'))
  const tx = id ? await getOwnTransaction(payload, user, id) : null
  if (!id || !tx) return { error: 'Transaction not found.' }
  const changes = formToEdit(
    {
      title: str(form.get('title')),
      note: str(form.get('note')),
      amount: str(form.get('amount')),
      date: str(form.get('date')),
      category: str(form.get('category')),
      account: str(form.get('account')),
      person: str(form.get('person')),
      tags: form.getAll('tags').map(String).filter(Boolean),
      shares: sharesOf(form),
      attachments: form.get('attachments_present') ? form.getAll('attachments').map(String) : undefined,
    },
    {
      title: tx.title,
      note: tx.note ?? '',
      amount: String(tx.amount),
      date: localInputValue(tx.date, timeZone),
      category: idOf(tx.category),
      account: idOf(tx.account),
      person: idOf(tx.person),
      tags: (tx.tags ?? []).map(idOf).filter((x): x is string => !!x),
      shares: (tx.shares ?? []).map((x) => ({ person: idOf(x.person) ?? '', amount: String(x.amount) })),
      attachments: (tx.attachments ?? []).map(idOf).filter((x): x is string => !!x),
    },
  )
  if (Object.keys(changes).length === 0) return { ok: 'No changes.' }
  const res = await editTransaction(payload, user, id, changes, timeZone)
  if ('error' in res) return res
  revalidatePath('/app', 'layout')
  return { ok: 'Saved.' }
}

/** Lists for the Add form, loaded when it opens (archived left out). */
export async function getAddFormLists() {
  const { payload, user } = await requireSession()
  const { childrenOf: _, ...lists } = await loadLookups(payload, user)
  const live = <T extends { archived: boolean }>(xs: T[]) => xs.filter((x) => !x.archived)
  return { categories: live(lists.categories), tags: live(lists.tags), people: live(lists.people), accounts: live(lists.accounts) }
}

/** Add form. On success the new transaction's id comes back. */
export async function addTransaction(_: AddState, form: FormData): Promise<AddState> {
  const { payload, user, timeZone } = await requireSession()
  const type = str(form.get('type')) as 'expense' | 'income' | 'transfer'
  const res = await createTransaction(
    payload,
    user,
    {
      type,
      title: str(form.get('title')) ?? '',
      amount: Number(form.get('amount')),
      date: (str(form.get('date')) ?? '').replace('T', ' '),
      category: str(form.get('category')) ?? '',
      account: str(form.get('account')) ?? '',
      toAccount: type === 'transfer' ? str(form.get('toAccount')) || null : null,
      person: type === 'transfer' ? null : str(form.get('person')) || null,
      tags: form.getAll('tags').map(String).filter(Boolean),
      note: str(form.get('note')),
      shares: type === 'expense' ? (sharesOf(form) ?? []).filter((x) => x.person) : [],
      attachments: form.getAll('attachments').map(String),
      allowDuplicate: form.get('allow_duplicate') === '1',
    },
    timeZone,
  )
  if ('error' in res) return res
  if ('duplicate' in res) return { duplicate: { ...res.duplicate, when: formatLocalDateTime(res.duplicate.date, timeZone) } }
  revalidatePath('/app', 'layout')
  return { ok: 'Added.', id: res.id }
}

export type AddState = { ok: string; id: string } | { error: string } | { duplicate: Duplicate & { when: string } } | null

/** Panel → Delete (to the trash). */
export async function deleteTransactionAction(id: string): Promise<{ ok: true } | { error: string }> {
  const { payload, user } = await requireSession()
  const res = await trashTransaction(payload, user, id)
  if ('ok' in res) revalidatePath('/app', 'layout')
  return res
}

/** Panel → Split into parts. */
export async function splitAction(id: string, parts: PartIn[]): Promise<{ ids: string[] } | { error: string }> {
  const { payload, user } = await requireSession()
  const res = await splitOwnTransaction(payload, user, id, parts)
  if ('ids' in res) revalidatePath('/app', 'layout')
  return res
}

/** Panel → Split → Ask AI: suggested parts, nothing saved. */
export async function suggestSplitAction(id: string, hint: string) {
  const { payload, user } = await requireSession()
  return suggestSplit(payload, user, id, hint)
}

/** Add panel → Ask AI: text and/or a receipt image → values for the form (nothing saved). */
export async function aiPrefillAction(form: FormData): Promise<{ prefill: Prefill } | { error: string }> {
  const { payload, user, timeZone } = await requireSession()
  const text = (str(form.get('text')) ?? '').trim().slice(0, 2000)
  const image = form.get('image')
  try {
    let result
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/')) return { error: 'Use a photo or screenshot.' }
      if (image.size > 8 * 1024 * 1024) return { error: 'The image is larger than 8 MB.' }
      const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')
      result = await processImageToTransaction(payload, String(user.id), base64, image.type, null, text || null)
    } else if (text) {
      result = await processTextToTransaction(payload, String(user.id), text, null)
    } else {
      return { error: 'Type what you spent, or add a receipt.' }
    }
    return { prefill: toPrefill(result.data, timeZone) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The AI could not read that.' }
  }
}

/** SMS queue: confirm (as suggested, or with the user's changes). */
export async function confirmSmsAction(id: string, overrides: ConfirmOverrides): Promise<{ transaction: string } | { error: string }> {
  const { payload, user } = await requireSession()
  const res = await confirmOwnSms(payload, user, id, overrides)
  if ('transaction' in res) revalidatePath('/app', 'layout')
  return res
}

export async function dismissSmsAction(id: string): Promise<{ ok: true } | { error: string }> {
  const { payload, user } = await requireSession()
  const res = await dismissOwnSms(payload, user, id)
  if ('ok' in res) revalidatePath('/app', 'layout')
  return res
}
