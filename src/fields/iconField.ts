import type { TextField } from 'payload'
import { validateIcon } from '../utilities/validateIcon'

/**
 * @param defaultValue - Default Lucide icon name (e.g. 'wallet', 'tag', 'folder')
 * @param withCell     - Include IconColorCell for list view columns
 */
export const iconField = (defaultValue: string, withCell = false): TextField => ({
  name: 'icon',
  type: 'text',
  required: true,
  defaultValue,
  validate: validateIcon,
  admin: {
    components: {
      Field: '@/components/admin/IconPickerField#IconPickerField',
      ...(withCell ? { Cell: '@/components/admin/IconColorCell#IconColorCell' } : {}),
    },
  },
})
