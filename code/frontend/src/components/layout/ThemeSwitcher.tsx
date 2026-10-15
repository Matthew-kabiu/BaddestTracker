import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/kit/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/kit/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/kit/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { THEMES, type Theme } from '@/lib/theme/theme'

const OPTIONS: Record<Theme, { name: string; label: string; icon: LucideIcon }> = {
  light: { name: 'Light', label: 'Light theme', icon: Sun },
  dark: { name: 'Dark', label: 'Dark theme', icon: Moon },
  system: { name: 'System', label: 'Match system theme', icon: Monitor },
}

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value)
}

/**
 * Light / Dark / System, from kit parts. `menu` (sidebar): one button opening a radio menu.
 * `segmented` (landing, auth): a three-way toggle group.
 */
export function ThemeSwitcher({
  variant = 'segmented',
  expanded = false,
}: {
  variant?: 'segmented' | 'menu'
  expanded?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const Current = OPTIONS[theme].icon

  if (variant === 'menu') {
    const trigger = (
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={expanded ? 'default' : 'icon'}
          aria-label={expanded ? undefined : 'Change theme'}
          className={expanded ? 'w-full justify-start' : ''}
        >
          <Current aria-hidden="true" />
          {expanded && (
            <>
              <span>Theme</span>
              <span className="ml-auto text-xs text-fg-subtle">{OPTIONS[theme].name}</span>
              <ChevronRight aria-hidden="true" />
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
            <TooltipContent side="right">Change theme</TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuContent side="right" align="end">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => isTheme(v) && setTheme(v)}>
            {THEMES.map((value) => {
              const { name, icon: Icon } = OPTIONS[value]
              return (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden="true" />
                  {name}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={theme}
      // Radix sends "" when the active item is clicked again; keep the current theme then.
      onValueChange={(v) => isTheme(v) && setTheme(v)}
      aria-label="Theme"
    >
      {THEMES.map((value) => {
        const { label, icon: Icon } = OPTIONS[value]
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem value={value} aria-label={label}>
                <Icon aria-hidden="true" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </ToggleGroup>
  )
}
