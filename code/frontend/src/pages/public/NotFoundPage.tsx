import { Home } from 'lucide-react'
import { useMatch, useNavigate } from 'react-router'

import { Button } from '@/components/kit/button'
import { PAGE_ROUTES } from '@/lib/routes'

/** Full screen on its own; inside the dashboard shell for unknown /dashboard/* addresses. */
export default function NotFoundPage() {
  const navigate = useNavigate()
  const inDashboard = useMatch(`${PAGE_ROUTES.dashboard.root}/*`) !== null

  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 p-6 text-center text-fg ${
        inDashboard ? 'min-h-[70dvh]' : 'min-h-dvh bg-canvas'
      }`}
    >
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-base text-fg-muted">That page doesn't exist or has moved.</p>
      <Button onClick={() => navigate(PAGE_ROUTES.dashboard.root)}>
        <Home aria-hidden="true" />
        Go home
      </Button>
    </div>
  )
}
