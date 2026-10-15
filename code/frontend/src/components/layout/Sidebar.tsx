import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'

import { NAV_ITEMS } from '@/components/layout/nav'
import { SidebarFooter } from '@/components/layout/SidebarFooter'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/kit/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { PAGE_ROUTES } from '@/lib/routes'

interface SidebarProps {
  expanded: boolean
  onToggle: () => void
}

/** Fixed, never scrolls with the page. Collapsed = icon rail with tooltips. */
export function Sidebar({ expanded, onToggle }: SidebarProps) {
  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface ${
        expanded ? 'w-(--sidebar-expanded)' : 'w-(--sidebar-collapsed)'
      }`}
    >
      <div
        className={`flex min-h-[10vh] items-center px-3 py-5 ${
          expanded ? 'justify-between' : 'justify-center'
        }`}
      >
        {expanded && <div className="min-w-0 flex-1"><Brand /></div>}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={expanded}
              onClick={onToggle}
              className="shrink-0"
            >
              {expanded ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{expanded ? 'Collapse sidebar' : 'Expand sidebar'}</TooltipContent>
        </Tooltip>
      </div>

      <nav className={`flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-4 ${expanded ? '' : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}`}>
        {expanded && (
          <p className="px-3 pb-2 text-xs font-medium text-fg-subtle">
            Your workspace
          </p>
        )}
        {NAV_ITEMS.map(({ label, href, icon: Icon }, index) => {
          const link = (
            <NavLink
              to={href}
              end={href === PAGE_ROUTES.dashboard.root}
              aria-label={expanded ? undefined : label}
              // A plain string, not NavLink's function form: the collapsed rail wraps this link in a
              // tooltip trigger, which merges classes as strings. NavLink marks the active link with
              // aria-current="page", so the active style keys off that.
              className={`group relative flex min-h-[5vh] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted outline-none transition-colors hover:bg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink aria-[current=page]:font-semibold motion-reduce:transition-none ${
                expanded ? '' : 'justify-center'
              }`}
            >
              <Icon aria-hidden="true" className="size-[1.2em] shrink-0" />
              {expanded && <span className="truncate">{label}</span>}
              {expanded && <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary opacity-0 group-aria-[current=page]:opacity-100" />}
            </NavLink>
          )
          // Collapsed rail: the label lives in a tooltip.
          return expanded ? (
            <div key={href} className={index === 3 || index === 6 ? 'mt-3 border-t border-line pt-4' : ''}>{link}</div>
          ) : (
            <Tooltip key={href}>
              <div className={index === 3 || index === 6 ? 'mt-3 border-t border-line pt-4' : ''}><TooltipTrigger asChild>{link}</TooltipTrigger></div>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <SidebarFooter expanded={expanded} />
    </aside>
  )
}
