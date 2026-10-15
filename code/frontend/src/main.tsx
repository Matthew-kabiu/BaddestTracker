import '@fontsource-variable/outfit'
import './index.css'

import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { router } from '@/App'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Toaster } from '@/components/kit/sonner'
import { TooltipProvider } from '@/components/kit/tooltip'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root is missing from index.html')

const unsubscribeSeo = router.subscribe(({ location }) => {
  window.dispatchEvent(new CustomEvent('baddest:route-change', { detail: { pathname: location.pathname } }))
})
if (import.meta.hot) import.meta.hot.dispose(unsubscribeSeo)

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingState fullScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </ErrorBoundary>
        {/* Bottom-right keeps toasts clear of page headers (quick add, page actions). */}
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
