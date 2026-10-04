import { currencyQueries } from './currencies'
import { timezoneQueries } from './timezones'
import { analyticsQueries } from './analytics'
import { aiMutations } from './ai'
import { smsMutations } from './sms'
import { balanceCheckQueries } from './balanceChecks'
import { statementMutations } from './statements'
import { recurringQueries } from './recurring'
import { duplicateQueries } from './duplicates'
import { searchQueries } from './search'
import { categoryReviewQueries } from './categoryReview'

export const graphQLQueries = () => ({
  ...currencyQueries(),
  ...timezoneQueries(),
  ...analyticsQueries(),
  ...balanceCheckQueries(),
  ...recurringQueries(),
  ...duplicateQueries(),
  ...searchQueries(),
  ...categoryReviewQueries(),
})

export const graphQLMutations = () => ({
  ...aiMutations(),
  ...smsMutations(),
  ...statementMutations(),
})
