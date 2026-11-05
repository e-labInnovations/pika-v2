import type { NextRequest } from 'next/server'

/**
 * Absolute URL on the app's public origin.
 *
 * Never build redirects from `request.url` / `request.nextUrl.origin` in
 * production: the standalone server binds 127.0.0.1:3333 behind nginx, so
 * those resolve to `https://localhost:3333`. NEXT_PUBLIC_SERVER_URL is the
 * canonical public origin (inlined at build time by CI); the request origin
 * is only a fallback for local dev.
 */
export function publicUrl(path: string, request: NextRequest): URL {
  return new URL(path, process.env.NEXT_PUBLIC_SERVER_URL || request.nextUrl.origin)
}
