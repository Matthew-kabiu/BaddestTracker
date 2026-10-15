// Route table ONLY — no page logic. Every path comes from PAGE_ROUTES.
// Pages are code-split with the router's own `lazy` (one chunk per page).
import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'

import { ErrorFallback } from '@/components/feedback/ErrorFallback'
import { LoadingState } from '@/components/feedback/LoadingState'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { PAGE_ROUTES } from '@/lib/routes'

type PageModule = Promise<{ default: ComponentType }>
const page = (load: () => PageModule) => async () => ({ Component: (await load()).default })

const d = PAGE_ROUTES.dashboard

// "Try again" reloads: it re-runs a crashed page and fetches page code a deploy replaced.
const reload = () => window.location.reload()
const PLACEHOLDER_MODULES = [d.ai]

export const router = createBrowserRouter([
  {
    errorElement: <ErrorFallback fullScreen reset={reload} />,
    hydrateFallbackElement: <LoadingState fullScreen />,
    children: [
      { path: PAGE_ROUTES.home, lazy: page(() => import('@/pages/public/LandingPage')) },
      {
        element: <PublicLayout />,
        children: [
          { path: PAGE_ROUTES.auth.signIn, lazy: page(() => import('@/pages/public/SignInPage')) },
          { path: PAGE_ROUTES.auth.signUp, lazy: page(() => import('@/pages/public/SignUpPage')) },
        ],
      },
      {
        path: d.root,
        element: (
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        ),
        children: [
          {
            // Errors in dashboard pages render inside the shell, so the sidebar stays usable.
            // The router clears this error when the user navigates elsewhere.
            errorElement: <ErrorFallback reset={reload} />,
            children: [
              { index: true, lazy: page(() => import('@/pages/dashboard/DashboardHome')) },
              { path: d.todos, lazy: page(() => import('@/pages/dashboard/TodosPage')) },
              { path: d.notes, lazy: page(() => import('@/pages/dashboard/NotesPage')) },
              { path: d.shopping, lazy: page(() => import('@/pages/dashboard/ShoppingPage')) },
              { path: d.budget, lazy: page(() => import('@/pages/dashboard/BudgetPage')) },
              { path: d.calendar, lazy: page(() => import('@/pages/dashboard/CalendarPage')) },
              { path: d.vault, lazy: page(() => import('@/pages/dashboard/VaultPage')) },
              { path: d.settings, lazy: page(() => import('@/pages/dashboard/SettingsPage')) },
              ...PLACEHOLDER_MODULES.map((path) => ({
                path,
                lazy: page(() => import('@/pages/dashboard/ModulePlaceholder')),
              })),
              { path: '*', lazy: page(() => import('@/pages/public/NotFoundPage')) },
            ],
          },
        ],
      },
      { path: PAGE_ROUTES.notFound, lazy: page(() => import('@/pages/public/NotFoundPage')) },
    ],
  },
])
