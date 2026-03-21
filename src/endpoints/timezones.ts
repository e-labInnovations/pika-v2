import type { PayloadHandler } from 'payload'
import { timezones } from '../data/timezones'

/**
 * GET /api/timezones
 * Returns all IANA timezones grouped by region with offset and display label.
 */
export const timezonesHandler: PayloadHandler = () => {
  return Response.json({ docs: timezones, totalDocs: timezones.length })
}

/**
 * GET /api/timezones/:id
 * Returns a single timezone by IANA id (e.g. "America/New_York").
 * Slash in the id should be encoded as %2F by the client.
 */
export const timezoneByIdHandler: PayloadHandler = (req) => {
  const raw = req.routeParams?.id as string
  const id = decodeURIComponent(raw)
  const timezone = timezones.find((tz) => tz.id === id)

  if (!timezone) {
    return Response.json({ errors: [{ message: `Timezone '${id}' not found` }] }, { status: 404 })
  }

  return Response.json(timezone)
}
