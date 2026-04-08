import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ConsentForm from './ConsentForm'

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

function getUserFromToken(token: string): { id: string; email: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return { id: payload.id, email: payload.email }
  } catch {
    return null
  }
}

export default async function ConsentPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    // Route handler will set the pending_oauth_params cookie and redirect to Google login.
    // We can't set cookies here — server components can only do so in route handlers/actions.
    const loginUrl = new URL('/oauth/login', process.env.NEXT_PUBLIC_SERVER_URL)
    Object.entries(params).forEach(([k, v]) => loginUrl.searchParams.set(k, v))
    redirect(loginUrl.pathname + loginUrl.search)
  }

  const user = getUserFromToken(token)
  if (!user) {
    // Malformed token — treat as unauthenticated
    const loginUrl = new URL('/oauth/login', process.env.NEXT_PUBLIC_SERVER_URL)
    Object.entries(params).forEach(([k, v]) => loginUrl.searchParams.set(k, v))
    redirect(loginUrl.pathname + loginUrl.search)
  }

  // URL params use snake_case (client_id, redirect_uri, code_challenge)
  const clientId = params['client_id']
  const clientName = params['client_name']
  const redirectUri = params['redirect_uri']
  const codeChallenge = params['code_challenge']
  const { state } = params

  if (!clientId || !redirectUri || !codeChallenge) {
    return (
      <div className="consent-error">
        <h1>Invalid Request</h1>
        <p>Missing required OAuth parameters. Please try connecting again from your MCP client.</p>
      </div>
    )
  }

  return (
    <ConsentForm
      userEmail={user.email}
      clientId={clientId}
      clientName={clientName || clientId}
      redirectUri={redirectUri}
      codeChallenge={codeChallenge}
      state={state}
    />
  )
}
