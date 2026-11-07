import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { userField } from '../fields'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? String((v as { id: unknown }).id) : v ? String(v) : null

/** One budget per category per user. */
const oneBudgetPerCategory: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  const user = idOf(data.user ?? originalDoc?.user)
  const category = idOf(data.category ?? originalDoc?.category)
  if (!user || !category) return data
  const clash = await req.payload.find({
    collection: 'budgets',
    where: {
      and: [
        { user: { equals: user } },
        { category: { equals: category } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    req,
  })
  if (clash.docs.length) throw new APIError('This category already has a budget.', 400, { code: 'budget_exists' })
  return data
}

/**
 * A monthly spending limit for a category (a parent category's budget includes its
 * subcategories). Progress: utilities/budgets.ts.
 */
export const Budgets: CollectionConfig = {
  slug: 'budgets',
  admin: { useAsTitle: 'id', defaultColumns: ['category', 'amount', 'user'], group: 'Pika' },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: { beforeChange: [setUserOnCreate, oneBudgetPerCategory] },
  fields: [
    userField,
    { name: 'category', type: 'relationship', relationTo: 'categories', required: true, index: true },
    { name: 'amount', type: 'number', required: true, min: 1, admin: { description: 'Monthly limit' } },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
  ],
  timestamps: true,
}
