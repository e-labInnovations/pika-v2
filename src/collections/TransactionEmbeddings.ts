import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const TransactionEmbeddings: CollectionConfig = {
  slug: 'transaction-embeddings',
  admin: {
    // hidden: true,
    group: 'Pika',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      // Denormalized from the transaction — never changes after creation.
      name: 'type',
      type: 'text',
      required: true,
      admin: { hidden: true },
    },
    {
      name: 'titleEmbedding',
      type: 'json',
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'titleEmbeddingModel',
      type: 'text',
      index: true,
      admin: { hidden: true, readOnly: true },
    },
  ],
}
