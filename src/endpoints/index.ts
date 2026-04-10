import { currenciesHandler, currencyByCodeHandler } from './currencies'
import { reseedHandler } from './seed'
import { randomSeedHandler } from './randomSeed'
import { timezonesHandler, timezoneByIdHandler } from './timezones'
import { weeklyExpensesHandler, monthlyCalendarHandler, dashboardHandler, monthlyCategoriesHandler, monthlyTagsHandler, monthlyPeopleHandler } from './analytics'
import { textToTransactionHandler, imageToTransactionHandler } from './ai'
import { migrateConnectHandler, migrateFetchHandler, migrateRunHandler } from './migrate'
import { seedPagesHandler } from './seedPages'

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
  {
    path: '/ai/text-to-transaction',
    method: 'post' as const,
    handler: textToTransactionHandler,
  },
  {
    path: '/ai/image-to-transaction',
    method: 'post' as const,
    handler: imageToTransactionHandler,
  },
  {
    path: '/seed/reseed',
    method: 'post' as const,
    handler: reseedHandler,
  },
  {
    path: '/seed/random',
    method: 'post' as const,
    handler: randomSeedHandler,
  },
  {
    path: '/seed/pages',
    method: 'post' as const,
    handler: seedPagesHandler,
  },
  {
    path: '/migrate/connect',
    method: 'post' as const,
    handler: migrateConnectHandler,
  },
  {
    path: '/migrate/fetch',
    method: 'post' as const,
    handler: migrateFetchHandler,
  },
  {
    path: '/migrate/run',
    method: 'post' as const,
    handler: migrateRunHandler,
  },
]
