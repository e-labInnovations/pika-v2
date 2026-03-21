import type { WidgetServerProps } from 'payload'
import { getUserTimezone } from '@/utilities/getUserTimezone'
import { calculateMonthlyCategories } from '@/utilities/calculateMonthlyCategories'
import { MonthlyCategoryWidgetClient } from './MonthlyCategoryWidgetClient'

export default async function MonthlyCategoryWidget({ req }: WidgetServerProps) {
  if (!req.user) return null
  const timezone = await getUserTimezone(req)
  const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  const [year, month] = localFmt.format(new Date()).split('-').map(Number)
  const data = await calculateMonthlyCategories(req.payload, req.user.id, month, year, timezone)
  return <MonthlyCategoryWidgetClient data={data} />
}
