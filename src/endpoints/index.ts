import { currenciesHandler, currencyByCodeHandler } from './currencies'
import { timezonesHandler, timezoneByIdHandler } from './timezones'
import { weeklyExpensesHandler, monthlyCalendarHandler, dashboardHandler, monthlyCategoriesHandler, monthlyTagsHandler, monthlyPeopleHandler } from './analytics'

export const endpoints = [
  {
    path: '/currencies',
    method: 'get' as const,
    handler: currenciesHandler,
  },
  {
    path: '/currencies/:code',
    method: 'get' as const,
    handler: currencyByCodeHandler,
  },
  {
    path: '/timezones',
    method: 'get' as const,
    handler: timezonesHandler,
  },
  {
    path: '/timezones/:id',
    method: 'get' as const,
    handler: timezoneByIdHandler,
  },
  {
    path: '/analytics/weekly-expenses',
    method: 'get' as const,
    handler: weeklyExpensesHandler,
  },
  {
    path: '/analytics/monthly-calendar',
    method: 'get' as const,
    handler: monthlyCalendarHandler,
  },
  {
    path: '/analytics/dashboard',
    method: 'get' as const,
    handler: dashboardHandler,
  },
  {
    path: '/analytics/monthly-categories',
    method: 'get' as const,
    handler: monthlyCategoriesHandler,
  },
  {
    path: '/analytics/monthly-tags',
    method: 'get' as const,
    handler: monthlyTagsHandler,
  },
  {
    path: '/analytics/monthly-people',
    method: 'get' as const,
    handler: monthlyPeopleHandler,
  },
]
