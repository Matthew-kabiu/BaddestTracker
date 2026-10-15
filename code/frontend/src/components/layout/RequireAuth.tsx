import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { LoadingState } from '@/components/feedback/LoadingState'
import { useSession } from '@/lib/auth/client'
import { PAGE_ROUTES } from '@/lib/routes'

/**
 * UX gate only — it hides screens from signed-out visitors. The real security boundary is the
 * backend: every API route checks the session itself.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) return <LoadingState label="Checking your session…" fullScreen />
  if (!session) {
    return <Navigate to={PAGE_ROUTES.auth.signIn} replace state={{ from: location.pathname }} />
  }
  return children
}
