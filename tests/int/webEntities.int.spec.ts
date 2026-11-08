// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import type { User } from '@/payload-types'

const { saveEntity, setArchived, deleteEntity } = await import('@/lib/web/entities')

describe('web manage lists', () => {
  let payload: Payload
  let me: User
  let other: User
  const stamp = Date.now()
  const mk = async (t: string) => (await payload.create({ collection: 'users', data: { email: `webent-${t}-${stamp}@example.com`, password: 'x-Test-12345', name: t } as any })) as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    me = await mk('me')
    other = await mk('other')
  })
  afterAll(async () => {
    for (const u of [me, other]) {
      const where = { user: { equals: u.id } }
      await payload.delete({ collection: 'transactions', where, trash: true } as any)
      await payload.delete({ collection: 'categories', where: { and: [where, { parent: { exists: true } }] } })
      for (const c of ['categories', 'tags', 'people', 'accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
      await payload.delete({ collection: 'users', id: u.id })
    }
  })

  it('creates and edits a tag; archive toggles; delete removes', async () => {
    const made = await saveEntity(payload, me, 'tags', null, { name: `Trip ${stamp}`, icon: 'plane', color: '#ffffff', bgColor: '#4d8eff' })
    expect(made).toHaveProperty('id')
    const id = (made as { id: string }).id
    expect(await saveEntity(payload, me, 'tags', id, { name: `Trip26 ${stamp}` })).toEqual({ id })
    expect((await payload.findByID({ collection: 'tags', id })).name).toBe(`Trip26 ${stamp}`)
    expect(await setArchived(payload, me, 'tags', id, true)).toEqual({ ok: true })
    expect((await payload.findByID({ collection: 'tags', id })).isActive).toBe(false)
    expect(await deleteEntity(payload, me, 'tags', id)).toEqual({ ok: true })
  })

  it("won't touch someone else's or a shared system record (even for an admin)", async () => {
    const theirs = (await saveEntity(payload, other, 'people', null, { name: 'Theirs' })) as { id: string }
    await payload.update({ collection: 'users', id: me.id, data: { role: 'admin' } as any, overrideAccess: true })
    try {
      const admin = (await payload.findByID({ collection: 'users', id: me.id })) as User
      expect(await saveEntity(payload, admin, 'people', theirs.id, { name: 'hijack' })).toHaveProperty('error')
      expect(await setArchived(payload, admin, 'people', theirs.id, true)).toHaveProperty('error')
      expect(await deleteEntity(payload, admin, 'people', theirs.id)).toHaveProperty('error')
      const sys = (await payload.find({ collection: 'tags', where: { 'user.role': { equals: 'system' } }, limit: 1, depth: 0 })).docs[0]
      if (sys) expect(await saveEntity(payload, admin, 'tags', String(sys.id), { name: 'x' })).toHaveProperty('error')
    } finally {
      await payload.update({ collection: 'users', id: me.id, data: { role: 'user' } as any, overrideAccess: true })
    }
    expect((await payload.findByID({ collection: 'people', id: theirs.id })).name).toBe('Theirs')
  })

  it('a subcategory needs a parent of the same type that the user can see', async () => {
    const parent = (await saveEntity(payload, me, 'categories', null, { name: `Hobby ${stamp}`, type: 'expense', icon: 'shapes' })) as { id: string }
    expect(parent).toEqual({ id: expect.any(String) })
    expect(await saveEntity(payload, me, 'categories', null, { name: 'Kites', type: 'income', parent: parent.id, icon: 'shapes' })).toHaveProperty('error')
    const kid = await saveEntity(payload, me, 'categories', null, { name: 'Kites', type: 'expense', parent: parent.id, icon: 'shapes' })
    expect(kid).toHaveProperty('id')
    const theirParent = (await saveEntity(payload, other, 'categories', null, { name: `P ${stamp}`, type: 'expense', icon: 'x' })) as { id: string }
    expect(await saveEntity(payload, me, 'categories', null, { name: 'Sneaky', type: 'expense', parent: theirParent.id, icon: 'x' })).toHaveProperty('error')
  })

  it('only known fields are written', async () => {
    const acc = (await saveEntity(payload, me, 'accounts', null, { name: `Bank ${stamp}`, user: other.id, isActive: false } as any)) as { id: string }
    const doc = await payload.findByID({ collection: 'accounts', id: acc.id, depth: 0 })
    expect(String(doc.user)).toBe(String(me.id))
    expect(doc.isActive).not.toBe(false)
  })

  it('won’t delete an account or category that is in use (archive instead)', async () => {
    const acc = (await saveEntity(payload, me, 'accounts', null, { name: `InUse ${stamp}` })) as { id: string }
    const cat = (await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 1, user: me, overrideAccess: false })).docs[0]
    const tx = await payload.create({ collection: 'transactions', data: { title: 'x', amount: '5', type: 'expense', date: new Date().toISOString(), category: cat.id, account: acc.id } as any, user: me, overrideAccess: false })
    const res = await deleteEntity(payload, me, 'accounts', acc.id)
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/archive/i)
    expect(String((await payload.findByID({ collection: 'transactions', id: tx.id, depth: 0 })).account)).toBe(acc.id)
  })

  it('a category with subcategories can’t be moved under another (no third level)', async () => {
    const a = (await saveEntity(payload, me, 'categories', null, { name: `TopA ${stamp}`, type: 'expense', icon: 'shapes' })) as { id: string }
    const b = (await saveEntity(payload, me, 'categories', null, { name: `TopB ${stamp}`, type: 'expense', icon: 'shapes' })) as { id: string }
    await saveEntity(payload, me, 'categories', null, { name: 'ChildOfA', type: 'expense', parent: a.id, icon: 'shapes' })
    expect(await saveEntity(payload, me, 'categories', a.id, { parent: b.id })).toHaveProperty('error')
  })
})
