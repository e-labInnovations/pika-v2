import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'
import type { User } from '@/payload-types'
import { userFromHeaders, userPrefs } from './session-core'

export type Session = { payload: Payload; user: User | null; timeZone: string; currency: string }

/** The signed-in user (payload-token cookie) and their timezone/currency, once per request. */
export const getSession = cache(async (): Promise<Session> => {
  const payload = await getPayload({ config })
  const user = await userFromHeaders(payload, await headers())
  const prefs = user ? await userPrefs(payload, String(user.id)) : { timeZone: 'Asia/Kolkata', currency: 'INR' }
  return { payload, user, ...prefs }
})

/** For pages and actions: the session with a user, or a redirect to /app/login. */
export async function requireSession(): Promise<Session & { user: User }> {
  const s = await getSession()
  if (!s.user) redirect('/app/login')
  return s as Session & { user: User }
}
