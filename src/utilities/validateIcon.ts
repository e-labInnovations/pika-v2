import { iconsData } from '../components/ui/icons-data'

const validIconNames = new Set(iconsData.map((i) => i.name))

export const validateIcon = (value: string | null | undefined): true | string => {
  if (!value) return 'Icon is required'
  if (!validIconNames.has(value)) return `'${value}' is not a valid icon name`
  return true
}
