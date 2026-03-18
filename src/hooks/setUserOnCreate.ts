import type { CollectionBeforeChangeHook } from 'payload'

export const setUserOnCreate: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  if (operation === 'create' && req.user) {
    data.user = req.user.id
  }

  return data
}