import { Home, RotateCcw } from 'lucide-react'

import { Button } from '@/components/kit/button'
import { PAGE_ROUTES } from '@/lib/routes'

interface ErrorFallbackProps {
  reset?: () => void
  /** Fill the whole viewport (no app shell around it) instead of the parent box. */
  fullScreen?: boolean
}

/** The single friendly error screen. No technical detail, ever. */
export function ErrorFallback({ reset, fullScreen = false }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className={`flex w-full flex-col items-center justify-center gap-4 p-6 text-center text-fg ${
        fullScreen ? 'min-h-dvh bg-canvas' : 'min-h-[70dvh]'
      }`}
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="w-11/12 text-base text-fg-muted sm:w-1/2">
        This isn't your fault. Try again, or head back to the dashboard.
      </p>
      <div className="flex gap-3">
        {reset && (
          <Button onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        )}
        <Button variant="outline" onClick={() => window.location.assign(PAGE_ROUTES.dashboard.root)}>
          <Home aria-hidden="true" />
          Go home
        </Button>
      </div>
    </div>
  )
}
