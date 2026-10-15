import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/kit/card'

/** A shared presentation for real module totals. */
export function DashboardMetric({ label, value, detail, icon: Icon, accent = false }: {
  label: string
  value: ReactNode
  detail: string
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <Card className={`min-w-0 gap-0 py-0 ${accent ? 'border-primary/20 bg-primary-soft' : 'bg-surface'}`}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-fg-muted">{label}</span>
          <Icon aria-hidden="true" className={`size-[1.2em] ${accent ? 'text-primary-ink' : 'text-fg-subtle'}`} />
        </div>
        <span className={`text-3xl leading-none font-semibold tracking-tight break-words tabular-nums ${accent ? 'text-primary-ink' : 'text-fg'}`}>{value}</span>
        <span className="text-xs text-fg-muted">{detail}</span>
      </CardContent>
    </Card>
  )
}
