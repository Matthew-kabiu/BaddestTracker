import type { LucideIcon } from 'lucide-react'
import { Bell, BellOff, CalendarClock, CheckCheck, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Badge } from '@/components/kit/badge'
import { Button } from '@/components/kit/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/kit/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/kit/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { useNotifications } from '@/hooks/use-notifications'
import type { AppNotification } from '@/types/api'

/** Icon per notification source (`kind` prefix). */
const ICONS: Record<string, LucideIcon> = { budget: Wallet, calendar: CalendarClock }

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Bell in the sidebar footer: unread count, and a panel of saved notifications. */
export function NotificationBell({ expanded }: { expanded: boolean }) {
  const navigate = useNavigate()
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications()
  const [open, setOpen] = useState(false)
  const label = unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'

  function openOne(n: AppNotification) {
    if (!n.readAt) void markRead(n.id)
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  const trigger = (
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        size={expanded ? 'default' : 'icon'}
        aria-label={expanded ? undefined : label}
        className={`relative ${expanded ? 'w-full justify-start' : ''}`}
      >
        <Bell aria-hidden="true" />
        {expanded && <span>Notifications</span>}
        {unreadCount > 0 && (
          <Badge
            aria-hidden="true"
            className={`tabular-nums ${expanded ? 'ml-auto' : 'absolute -top-1 -right-1 px-1.5'}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {expanded ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      )}
      <PopoverContent side="right" align="end" className="flex w-[min(90vw,max(26vw,48vh))] flex-col gap-0 p-0">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </header>
        {items.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary-soft text-primary-ink">
                <BellOff aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-base">You're all caught up</EmptyTitle>
              <EmptyDescription>Budget alerts and reminders will show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex max-h-[60vh] flex-col divide-y overflow-y-auto">
            {items.map((n) => {
              const Icon = ICONS[n.kind.split('.')[0]] ?? Bell
              return (
                <li key={n.id} className="group relative flex items-start">
                  <Button
                    variant="ghost"
                    onClick={() => openOne(n)}
                    className="h-auto flex-1 items-start justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal"
                  >
                    <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-primary-soft p-1.5 text-primary-ink">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
                      <span className="flex items-center gap-2">
                        {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        <span className="truncate text-sm font-medium text-fg">{n.title}</span>
                      </span>
                      <span className="text-sm font-normal text-fg-muted">{n.body}</span>
                      <span className="text-xs font-normal text-fg-subtle">{timeAgo(n.createdAt)}</span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Dismiss "${n.title}"`}
                    onClick={() => void remove(n.id)}
                    className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
