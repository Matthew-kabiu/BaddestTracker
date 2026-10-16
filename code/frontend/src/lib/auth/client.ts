import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

/**
 * Better Auth React client. Sessions live in httpOnly cookies set by the auth service.
 * No baseURL: auth is served from this origin under /api/auth (nginx in production, Vite proxy in dev).
 */
export const authClient = createAuthClient({
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
