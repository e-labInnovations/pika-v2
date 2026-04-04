import type { WidgetServerProps } from 'payload'
import type { User } from '@/payload-types'
import { ReseedWidgetClient } from './ReseedWidgetClient'

export default function ReseedWidget({ req }: WidgetServerProps) {
  const user = req.user as User | null
  if (!user || user.role !== 'admin') return null
  return <ReseedWidgetClient />
}
