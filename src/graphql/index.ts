import { currencyQueries } from './currencies'

export const graphQLQueries = () => ({
  ...currencyQueries(),
})
