import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { NAV_ITEMS } from '@/components/layout/nav'
import { Settings2 } from 'lucide-react'

interface PageProps {
  title: string
  /** One line under the title; announced politely when it changes (counts, totals). */
  description?: ReactNode
  /** Right side of the header: the page's primary action or a key figure. */
  actions?: ReactNode
  children: ReactNode
}

/** The one dashboard page frame: same width, header and spacing on every page. */
export function Page({ title, description, actions, children }: PageProps) {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((entry) => entry.href === pathname)
  const Icon = item?.icon ?? Settings2
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[78vw] flex-col gap-7 max-lg:max-w-full [&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:shadow-xs [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:active:scale-[0.98] [&_[data-slot=button]]:motion-reduce:transform-none">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-muted">
            <Icon aria-hidden="true" className="size-[1.2em] text-primary-ink" />
            <span>Workspace</span><span aria-hidden="true" className="text-fg-subtle">/</span><span>{item?.label ?? 'Settings'}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && (
            <p className="text-sm leading-relaxed text-fg-muted" aria-live="polite">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-3">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
