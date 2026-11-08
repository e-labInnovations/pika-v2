'use server'

import { revalidatePath } from 'next/cache'

import { requireSession } from '@/lib/session'
import { formToEdit } from '@/lib/web/edit'
import { localInputValue } from '@/lib/web/format'
import { editTransaction, getOwnTransaction } from '@/lib/web/transactions'

export type ActionState = { ok: string } | { error: string } | null

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : undefined)
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
    },
  )
  if (Object.keys(changes).length === 0) return { ok: 'No changes.' }
  const res = await editTransaction(payload, user, id, changes, timeZone)
  if ('error' in res) return res
  revalidatePath('/app', 'layout')
  return { ok: 'Saved.' }
}
