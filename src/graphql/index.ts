import { currencyQueries } from './currencies'
import { timezoneQueries } from './timezones'
import { analyticsQueries } from './analytics'
import { aiMutations } from './ai'
import { smsMutations } from './sms'
import { balanceCheckQueries } from './balanceChecks'

export const graphQLQueries = () => ({
  ...currencyQueries(),
  ...timezoneQueries(),
  ...analyticsQueries(),
  ...balanceCheckQueries(),
})

export const graphQLMutations = () => ({
  ...aiMutations(),
  ...smsMutations(),
})
