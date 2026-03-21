import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { ownOrSystemRecords } from '../access/ownOrSystemRecords'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { userField } from '../fields/userField'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon', 'isActive', 'user'],
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
    userField,
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
          Field: '@/components/admin/IconPickerField#IconPickerField',
          Cell: '@/components/admin/IconColorCell#IconColorCell',
        },
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
