import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  RelationshipFieldSingleValidation,
  Where,
} from 'payload'
import type { User, Transaction } from '../payload-types'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields'
import { ValidationError } from 'payload'
import { scheduleTitleEmbedding, invalidateUserHistoryCache } from '../utilities/ai/user-history'

/**
 * Validate the destination account for transfers
 * - Destination account is required for transfers
 * - Destination account must differ from the source account
 */
/**
 * Embed the transaction title for later MiniLM-based category prediction,
 * and invalidate the user's in-memory history cache so the next prediction
 * picks up the fresh row. Fire-and-forget — never block the write response.
 */
const extractPromptId: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  if (operation !== 'create') return data
  // REST clients: pass promptId in the request body
  // GraphQL clients: pass promptId via X-Prompt-Id header (GraphQL input types are strict)
  const promptId = (data as any).promptId ?? req.headers?.get?.('x-prompt-id') ?? (req.headers as any)?.['x-prompt-id']
  if (promptId) {
    req.context = { ...req.context, promptId }
    delete (data as any).promptId
  }
  return data
}

const afterCreateLinkPrompt: CollectionAfterChangeHook = ({ doc, req, operation }) => {
  if (operation !== 'create') return
  const promptId = req.context?.promptId
  if (!promptId) return
  req.payload.update({
    collection: 'ai-prompts',
    id: promptId as string,
    data: { transaction: doc.id },
    overrideAccess: true,
  }).catch(() => {})
}

const afterChangeEmbedTitle: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  const userId = typeof doc.user === 'string' ? doc.user : doc.user?.id
  if (userId) invalidateUserHistoryCache(String(userId))

  // Avoid re-entering this hook when we write the embedding back below.
  if ((context as any)?.skipEmbeddingHook) return

  const titleChanged = doc.title !== previousDoc?.title
  const hasEmbedding = !!doc.titleEmbedding
  if (!titleChanged && hasEmbedding) return

  // Schedule async — do not await. Errors are swallowed inside.
  scheduleTitleEmbedding(req.payload, doc.id, doc.title).catch(() => {})
}

const validateToAccount: CollectionBeforeChangeHook = async ({ data, operation, originalDoc }) => {
  const type = data?.type ?? (operation === 'update' ? originalDoc?.type : undefined)
  if (type === 'transfer') {
    const account = data?.account ?? originalDoc?.account
    const toAccount = data?.toAccount ?? originalDoc?.toAccount
    const errors: { message: string; path: string }[] = []
    if (!toAccount)
      errors.push({ message: 'Destination account is required for transfers.', path: 'toAccount' })
    if (toAccount && account && String(toAccount) === String(account))
      errors.push({
        message: 'Destination account must differ from the source account.',
        path: 'toAccount',
      })
    if (errors.length) throw new ValidationError({ errors })
  }
  return data
}

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  trash: true,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'amount', 'type', 'date', 'account', 'user'],
    group: 'Pika',
  },
  access: {
    create: isNotSystem,
    read: isAdminOrOwn,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [extractPromptId, setUserOnCreate, validateToAccount],
    afterChange: [afterCreateLinkPrompt, afterChangeEmbedTitle],
  },
  fields: [
    userField,
    {
      name: 'aiAssistant',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/AITransactionPanel#AITransactionPanel',
        },
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      // Stored as text to preserve decimal precision (e.g. "1234.5600")
      name: 'amount',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'Amount is required'
        if (!/^\d+(\.\d{1,4})?$/.test(value))
          return 'Amount must be a positive number with up to 4 decimal places'
        return true
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeFormat: 'HH:mm',
          timeIntervals: 15,
          displayFormat: 'MMM d, yyyy HH:mm',
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Income', value: 'income' },
        { label: 'Expense', value: 'expense' },
        { label: 'Transfer', value: 'transfer' },
      ],
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      validate: (async (value, { req, siblingData, id, operation }) => {
        if (!value) return true
        const category = await req.payload.findByID({
          collection: 'categories',
          id: value as string,
          depth: 0,
        })
        if (!category.parent)
          return 'Only child categories can be used. Please select a subcategory.'
        let txType = (siblingData as { type?: Transaction['type'] })?.type
        if (!txType && operation === 'update' && id) {
          const existing = await req.payload.findByID({
            collection: 'transactions',
            id: id as string,
            depth: 0,
          })
          txType = existing?.type as Transaction['type'] | undefined
        }
        if (txType && category.type !== txType)
          return `Category type must match transaction type. Expected "${txType}", got "${category.type}".`
        return true
      }) as RelationshipFieldSingleValidation,
      admin: {
        components: {
          Field: '@/components/admin/CategoryPickerField#CategoryPickerField',
        },
      },
      filterOptions: async ({ user, req, data }) => {
        if (!user) return true
        const u = user as User
        if (u.role === 'admin') return data?.type ? { type: { equals: data.type } } : true
        const found = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        const sysIds = found.docs.map((u) => u.id)
        const ownerFilter = {
          or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])],
        }
        if (!data?.type) return ownerFilter
        return { and: [ownerFilter, { type: { equals: data.type } }] } as Where
      },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'accounts',
      required: true,
      filterOptions: ({ user, data }) => {
        if (!user) return false
        if (data?.toAccount)
          return {
            and: [{ user: { equals: user.id } }, { id: { not_equals: data.toAccount } }],
          } as Where
        return { user: { equals: user.id } } as Where
      },
      admin: {
        components: {
          Field: '@/components/admin/AccountPickerField#AccountPickerField',
        },
      },
    },
    {
      name: 'toAccount',
      type: 'relationship',
      relationTo: 'accounts',
      filterOptions: ({ user, data }) => {
        if (!user) return false
        if (data?.account)
          return {
            and: [{ user: { equals: user.id } }, { id: { not_equals: data.account } }],
          } as Where
        return { user: { equals: user.id } } as Where
      },
      admin: {
        condition: (data) => data?.type === 'transfer',
        description: 'Destination account for transfers',
        components: {
          Field: '@/components/admin/AccountPickerField#AccountPickerField',
        },
      },
    },
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
      admin: {
        condition: (data) => data?.type !== 'transfer',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        components: {
          Field: '@/components/admin/TagPickerField#TagPickerField',
        },
      },
      filterOptions: async ({ user, req }) => {
        if (!user) return true
        const u = user as User
        if (u.role === 'admin') return true
        const found = await req.payload.find({
          collection: 'users',
          where: { role: { equals: 'system' } },
          limit: 100,
          depth: 0,
        })
        const sysIds = found.docs.map((u) => u.id)
        return {
          or: [{ user: { equals: user.id } }, ...(sysIds.length ? [{ user: { in: sysIds } }] : [])],
        }
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      filterOptions: ({ user }) => {
        if (!user) return false
        return { user: { equals: user.id } }
      },
    },
    {
      name: 'note',
      type: 'textarea',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    // ── MiniLM title embedding (cached for history-based prediction) ────────
    // Populated by afterChangeEmbedTitle when the title changes. Nullable on
    // existing rows — back-filled lazily in the background on first prediction.
    {
      name: 'titleEmbedding',
      type: 'json',
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'titleEmbeddingModel',
      type: 'text',
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'outgoingLinks',
      type: 'join',
      collection: 'transaction-links',
      on: 'from',
      admin: {
        description: 'Links where this transaction is the source (e.g. this repaid another)',
      },
    },
    {
      name: 'incomingLinks',
      type: 'join',
      collection: 'transaction-links',
      on: 'to',
      admin: {
        description: 'Links where this transaction is the target (e.g. others repaid this)',
      },
    },
  ],
}
