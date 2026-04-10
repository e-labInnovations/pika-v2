import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { RichTextBlock } from '../blocks/RichTextBlock'
import { BannerBlock } from '../blocks/BannerBlock'
import { CodeBlock } from '../blocks/CodeBlock'

/** Auto-generate slug from title on create if not provided. */
const generateSlug: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation === 'create' && data.title && !data.slug) {
    data.slug = data.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }
  return data
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: 'Content',
  },
  access: {
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    // Pages are publicly readable (terms, privacy, etc.)
    read: () => true,
  },
  hooks: {
    beforeChange: [generateSlug],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL path for this page (e.g. "privacy-policy" → /pages/privacy-policy)',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string'
              ? value
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
              : value,
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Short summary used in meta tags and page listings.',
        position: 'sidebar',
      },
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [RichTextBlock, BannerBlock, CodeBlock],
      required: true,
      admin: {
        initCollapsed: false,
        description: 'Build the page content using blocks.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { displayFormat: 'MMM dd yyyy' },
      },
    },
  ],
}
