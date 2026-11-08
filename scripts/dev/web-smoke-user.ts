/**
 * Dev only: creates (or removes, with --remove) a throwaway user with sample data for
 * checking the web dashboard. Prints the email and password.
 *   npx payload run scripts/dev/web-smoke-user.ts [--remove]
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const EMAIL = 'web-smoke@example.com'
const PASSWORD = 'x-Smoke-12345'

const payload = await getPayload({ config })
const found = await payload.find({ collection: 'users', where: { email: { equals: EMAIL } }, limit: 1 })
if (found.docs[0]) {
  const where = { user: { equals: found.docs[0].id } }
  await payload.delete({ collection: 'transactions', where, trash: true } as any)
  for (const c of ['budgets', 'tags', 'people', 'accounts', 'user-settings'] as const) await payload.delete({ collection: c, where })
  await payload.delete({ collection: 'users', id: found.docs[0].id })
}
if (!process.argv.includes('--remove')) {
  const user = await payload.create({ collection: 'users', data: { email: EMAIL, password: PASSWORD, name: 'Smoke Test' } as any })
  await payload.update({ collection: 'user-settings', where: { user: { equals: user.id } }, data: { timezone: 'Asia/Kolkata' } as any })
  const as = { user, overrideAccess: false as const }
  const acc = await payload.create({ collection: 'accounts', data: { name: 'Federal', icon: 'landmark' } as any, ...as })
  const person = await payload.create({ collection: 'people', data: { name: 'Rony' } as any, ...as })
  const tag = await payload.create({ collection: 'tags', data: { name: 'Trip', icon: 'plane' } as any, ...as })
  const cats = await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'expense' } }, { parent: { exists: true } }] }, limit: 2, ...as })
  const inc = await payload.find({ collection: 'categories', where: { and: [{ type: { equals: 'income' } }, { parent: { exists: true } }] }, limit: 1, ...as })
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
  const rows = [
    { title: 'Salary', amount: '50000', type: 'income', category: inc.docs[0].id, date: day(6) },
    { title: 'Lunch', amount: '250', type: 'expense', category: cats.docs[0].id, date: day(1), tags: [tag.id] },
    { title: 'Dinner with Rony', amount: '1200', type: 'expense', category: cats.docs[0].id, date: day(2), person: person.id },
    { title: 'Taxi', amount: '430', type: 'expense', category: cats.docs[1].id, date: day(3), tags: [tag.id] },
  ]
  for (const r of rows) await payload.create({ collection: 'transactions', data: { ...r, account: acc.id } as any, ...as })
  await payload.create({ collection: 'budgets', data: { category: cats.docs[0].id, amount: '1000' } as any, ...as })
  console.log(`SMOKE ${EMAIL} ${PASSWORD}`)
}
process.exit(0)
