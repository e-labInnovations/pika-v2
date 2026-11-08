'use server'

import { revalidatePath } from 'next/cache'

import { requireSession } from '@/lib/session'
import { editTransaction } from '@/lib/web/transactions'

export type ActionState = { ok: string } | { error: string } | null

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : undefined)

/** Edit form on the transaction panel. */
export async function saveTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user, timeZone } = await requireSession()
  const id = str(form.get('id'))
  if (!id) return { error: 'Missing transaction.' }
  const date = str(form.get('date'))
  const person = str(form.get('person'))
  const res = await editTransaction(
    payload,
    user,
    id,
    {
      title: str(form.get('title')),
      note: str(form.get('note')),
      amount: form.get('amount') == null ? undefined : Number(form.get('amount')),
      date: date ? date.replace('T', ' ') : undefined,
      category: str(form.get('category')) || undefined,
      account: str(form.get('account')) || undefined,
      person: person === undefined ? undefined : person || null,
      tags: form.getAll('tags').map(String).filter(Boolean),
    },
    timeZone,
  )
  if ('error' in res) return res
  revalidatePath('/app', 'layout')
  return { ok: 'Saved.' }
}
