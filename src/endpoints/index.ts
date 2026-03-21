import { currenciesHandler, currencyByCodeHandler } from './currencies'
import { timezonesHandler, timezoneByIdHandler } from './timezones'

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
]
