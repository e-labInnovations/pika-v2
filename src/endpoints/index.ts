import { currenciesHandler, currencyByCodeHandler } from './currencies'

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
]
