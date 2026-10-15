import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { LoadingState } from '@/components/feedback/LoadingState'
import { Sidebar } from '@/components/layout/Sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { LiveEventsProvider } from '@/lib/events/LiveEventsProvider'
import { VaultProvider } from '@/lib/vault/VaultProvider'

/** The one dashboard shell. The page never scrolls — only <main> does. */
export function DashboardLayout() {
  const { expanded, toggle } = useSidebar()

  return (
    <LiveEventsProvider>
      <VaultProvider>
        <div className="h-dvh overflow-hidden bg-canvas text-fg">
          <Sidebar expanded={expanded} onToggle={toggle} />
          <div
            className={`flex h-dvh min-w-0 flex-col ${
              expanded ? 'pl-(--sidebar-collapsed) lg:pl-(--sidebar-expanded)' : 'pl-(--sidebar-collapsed)'
            }`}
          >
            <main id="dashboard-content" className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
              <Suspense fallback={<LoadingState />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
      </VaultProvider>
    </LiveEventsProvider>
  )
}
