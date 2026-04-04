import type { CollectionConfig } from 'payload'
import { isNotSystem } from '../access/isNotSystem'
import { isAdminOrOwn } from '../access/isAdminOrOwn'
import { ownOrSystemRecords } from '../access/ownOrSystemRecords'
import { setUserOnCreate } from '../hooks/setUserOnCreate'
import { preventDeleteIfUsedInTransactions } from '../hooks/preventDeleteIfUsedInTransactions'
import {
  userField,
  iconField,
  colorField,
  bgColorField,
  isActiveField,
  descriptionField,
} from '../fields'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon', 'isActive', 'user'],
    group: 'Pika',
  },
  access: {
    create: isNotSystem,
    read: ownOrSystemRecords,
    update: isAdminOrOwn,
    delete: isAdminOrOwn,
  },
  hooks: {
    beforeChange: [setUserOnCreate],
    beforeDelete: [preventDeleteIfUsedInTransactions('tags')],
  },
  fields: [
    userField,
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    iconField('tag', true),
    colorField,
    bgColorField,
    descriptionField,
    isActiveField,
  ],
}
