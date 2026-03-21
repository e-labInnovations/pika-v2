import type { PayloadHandler } from 'payload'
import { currencies } from '../data/currencies'

/**
 * GET /api/currencies
 * Returns all currencies as an array, sorted by code.
 */
export const currenciesHandler: PayloadHandler = () => {
  const docs = Object.values(currencies).sort((a, b) => a.code.localeCompare(b.code))
  return Response.json({ docs, totalDocs: docs.length })
}

/**
 * GET /api/currencies/:code
 * Returns a single currency by its ISO code (case-insensitive).
 */
export const currencyByCodeHandler: PayloadHandler = (req) => {
  const code = (req.routeParams?.code as string)?.toUpperCase()
  const currency = currencies[code]

  if (!currency) {
    return Response.json({ errors: [{ message: `Currency '${code}' not found` }] }, { status: 404 })
  }

  return Response.json(currency)
}
