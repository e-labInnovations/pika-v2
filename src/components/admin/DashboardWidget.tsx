import type { WidgetServerProps } from 'payload'
import { getUserTimezone } from '@/utilities/getUserTimezone'
import { calculateDashboard } from '@/utilities/calculateDashboard'
import { DashboardWidgetClient } from './DashboardWidgetClient'

export default async function DashboardWidget({ req }: WidgetServerProps) {
  if (!req.user) return null
  const timezone = await getUserTimezone(req)
  const data = await calculateDashboard(req.payload, req.user.id, timezone)
  return <DashboardWidgetClient data={data} />
}
