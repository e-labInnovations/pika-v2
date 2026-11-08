import Image from 'next/image'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/session'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await getSession()
  if (user) redirect('/app')
  const { error } = await searchParams
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Image src="/icons/favicon.svg" alt="" width={48} height={48} className="mx-auto" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Pika</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your money, on a big screen.</p>
        {error && <p className="mt-4 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">Sign-in didn&apos;t work. Try again.</p>}
        <a
          href="/api/auth/oauth/authorization/google"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Continue with Google
        </a>
      </div>
    </main>
  )
}
