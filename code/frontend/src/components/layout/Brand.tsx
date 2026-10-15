import { Layers } from 'lucide-react'

import { env } from '@/lib/config/env'

interface BrandProps {
  /** Hide the wordmark (collapsed sidebar); the mark keeps an accessible name. */
  markOnly?: boolean
}

/** Logo mark + app name. One component so the brand looks identical everywhere. */
export function Brand({ markOnly = false }: BrandProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden={markOnly ? undefined : true}
        aria-label={markOnly ? env.VITE_APP_NAME : undefined}
        role={markOnly ? 'img' : undefined}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary-hover p-1.5 text-primary-fg shadow-sm"
      >
        <Layers aria-hidden="true" className="size-[1.15em]" />
      </span>
      {!markOnly && (
        <span className="truncate text-base font-semibold tracking-tight text-fg">{env.VITE_APP_NAME}</span>
      )}
    </span>
  )
}
