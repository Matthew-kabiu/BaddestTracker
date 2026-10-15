import { AccountMenu } from '@/components/layout/AccountMenu'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'

/** Notifications, appearance and the account menu stay at the bottom of the fixed sidebar. */
export function SidebarFooter({ expanded }: { expanded: boolean }) {
  return (
    <div className={`flex shrink-0 flex-col gap-2 border-t border-line bg-muted/30 px-2.5 py-4 ${expanded ? '' : 'items-center'}`}>
      <NotificationBell expanded={expanded} />
      <ThemeSwitcher variant="menu" expanded={expanded} />
      <AccountMenu expanded={expanded} />
    </div>
  )
}
