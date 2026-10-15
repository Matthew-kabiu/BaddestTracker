import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

import { env } from '@/lib/config/env'

/** Better Auth React client. Sessions live in httpOnly cookies set by the auth service. */
export const authClient = createAuthClient({
  baseURL: env.VITE_AUTH_BASE_URL,
  fetchOptions: { credentials: 'include' },
  // Mirrors `user.additionalFields` in code/auth/src/auth.ts.
  plugins: [inferAdditionalFields({ user: { currency: { type: 'string', required: false } } })],
})

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  updateUser,
  changeEmail,
  changePassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = authClient
