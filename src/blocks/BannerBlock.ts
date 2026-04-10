import type { Block } from 'payload'

export const BannerBlock: Block = {
  slug: 'banner',
  labels: { singular: 'Banner', plural: 'Banners' },
  fields: [
    {
      name: 'style',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
      ],
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
  ],
}
