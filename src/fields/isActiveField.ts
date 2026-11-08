import type { CheckboxField } from 'payload'
import { invalidateUserHistoryCache } from '../utilities/ai/user-history'

/**
 * Off = archived: kept for history and reports, no longer offered in pickers,
 * suggestions or the AI prompt (see utilities/archived.ts).
 */
export const isActiveField: CheckboxField = {
  name: 'isActive',
  label: 'Active (untick to archive)',
  type: 'checkbox',
  defaultValue: true,
  hooks: {
    afterChange: [
      ({ value, previousValue, originalDoc, siblingData }) => {
        if (value === previousValue) return
        // Suggestions from history are cached per user; drop them so archiving applies now.
        const user = (originalDoc as { user?: unknown } | undefined)?.user ?? siblingData?.user
        const userId = user && typeof user === 'object' ? (user as { id: unknown }).id : user
        if (userId) invalidateUserHistoryCache(String(userId))
      },
    ],
  },
}
