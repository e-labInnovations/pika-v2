import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { ownOrSystemRecords } from '../access/ownOrSystemRecords'
import { setUserOnCreate } from '../hooks/setUserOnCreate'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isActive', 'user'],
  },
  access: {
    create: isNotSystem,
    read: ownOrSystemRecords,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/IconPickerField#IconPickerField'
        }
      },
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField'
        }
      },
    },
    {
      name: 'bgColor',
      type: 'text',
      label: 'Background Color',
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField'
        }
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
