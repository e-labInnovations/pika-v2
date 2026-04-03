import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

function getExpFromJwt(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export default async function AuthCallback() {
  const cookieStore = await cookies()
  const isMobile = cookieStore.has('mobile_oauth')
  const token = cookieStore.get('payload-token')?.value

  if (!isMobile) redirect('/admin')
  if (!token) redirect('/admin/login?error=oauth_failed')

  const exp = getExpFromJwt(token)
  const params = new URLSearchParams({ token })
  if (exp) params.set('exp', String(exp))
  redirect(`pika://auth?${params}`)
}
