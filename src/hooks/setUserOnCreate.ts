import type { CollectionBeforeChangeHook } from 'payload'

export const setUserOnCreate: CollectionBeforeChangeHook = ({ data, req, operation }) => {
  if (operation !== 'create') return data

  const overrideUserId = req.context?.overrideUserId
  if (overrideUserId) {
    data.user = overrideUserId
  } else if (req.user) {
    data.user = req.user.id
  }

  return data
}