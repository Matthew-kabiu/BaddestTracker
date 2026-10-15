import { ChevronsUpDown, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { notify } from '@/components/feedback/toast'
import { Avatar, AvatarFallback } from '@/components/kit/avatar'
import { Button } from '@/components/kit/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/kit/dropdown-menu'
import { Spinner } from '@/components/kit/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { signOut, useSession } from '@/lib/auth/client'
import { PAGE_ROUTES } from '@/lib/routes'

function initials(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email || '?'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase()
}

/** The user's avatar; clicking it opens Settings and Sign out. */
export function AccountMenu({ expanded }: { expanded: boolean }) {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const user = session?.user
  if (!user) return null

  const name = user.name || 'Signed in'

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) {
        notify.error(null, "We couldn't sign you out. Please try again.")
        return
      }
      navigate(PAGE_ROUTES.auth.signIn, { replace: true })
    } catch {
      notify.error(null, "We couldn't sign you out. Please try again.")
    } finally {
      setSigningOut(false)
    }
  }

  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size={expanded ? 'lg' : 'icon'}
        aria-label={`Account menu for ${name}`}
        className={expanded ? 'h-auto w-full justify-start gap-2.5 px-2 py-2' : 'rounded-full'}
      >
        <Avatar>
          <AvatarFallback className="bg-primary-soft font-semibold text-primary-ink">
            {initials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        {expanded && (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left leading-tight">
              <span className="truncate text-sm font-medium text-fg">{name}</span>
              <span className="truncate text-xs font-normal text-fg-subtle">{user.email}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-fg-subtle" />
          </>
        )}
      </Button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {expanded ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">Account</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent side="right" align="end" className="min-w-56">
        <DropdownMenuLabel className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          <span className="truncate text-xs font-normal text-fg-subtle">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={PAGE_ROUTES.dashboard.settings}>
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          // Keep the menu open while signing out so the spinner stays visible.
          onSelect={(e) => {
            e.preventDefault()
            void handleSignOut()
          }}
        >
          {signingOut ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
