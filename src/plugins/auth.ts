import { authPlugin } from 'payload-auth-plugin'
import { GoogleAuthProvider } from 'payload-auth-plugin/providers'

export const auth = authPlugin({
  name: 'auth',
  useAdmin: true,
  allowOAuthAutoSignUp: true,
  usersCollectionSlug: 'users',
  accountsCollectionSlug: 'oauth-accounts',
  successRedirectPath: '/admin',
  errorRedirectPath: '/admin/login',
  providers: [
    GoogleAuthProvider({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      params: {
        prompt: 'select_account',
      },
    }),
  ],
})
