import { Pencil, ShoppingCart, Trash2 } from 'lucide-react'

import { periodInfo } from '@/components/budget/periods'
import { Badge } from '@/components/kit/badge'
import { Button } from '@/components/kit/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Progress } from '@/components/kit/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { formatDay } from '@/lib/format/dates'
import { useMoney } from '@/hooks/use-money'
import type { BudgetSummary } from '@/types/api'

/** One budget: spend against the amount for the current window, with an over-budget state. */
export function BudgetCard({ budget, onRequestEdit, onRequestDelete }: { budget: BudgetSummary; onRequestEdit: () => void; onRequestDelete: () => void }) {
  const formatMoney = useMoney()
  const { label, window: when } = periodInfo(budget.period)
  const pct = Math.min(100, Math.round((budget.spentCents / budget.amountCents) * 100))
  const left = budget.amountCents - budget.spentCents
  const over = left < 0
  const range =
    budget.window.start === budget.window.end
      ? formatDay(budget.window.start)
      : `${formatDay(budget.window.start)} to ${formatDay(budget.window.end, true)}`

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {budget.name}
          {over && <Badge variant="destructive">Over</Badge>}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{label}</Badge>
          {budget.includesShopping && (
            <Badge variant="outline">
              <ShoppingCart aria-hidden="true" />
              Shopping
            </Badge>
          )}
          <span>{range}</span>
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${budget.name}`} onClick={onRequestEdit}>
                <Pencil aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit budget</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Delete ${budget.name}`} className="hover:text-danger-ink" onClick={onRequestDelete}>
                <Trash2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete budget</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(budget.spentCents)}</span>
          <span className="text-sm text-fg-muted tabular-nums">of {formatMoney(budget.amountCents)}</span>
        </div>
        <Progress
          value={pct}
          aria-label={`${budget.name}: ${pct}% used ${when}`}
          className={over ? 'bg-danger-soft *:bg-danger' : ''}
        />
        <p className={`text-sm tabular-nums ${over ? 'text-danger-ink' : 'text-fg-muted'}`}>
          {over ? `${formatMoney(-left)} over ${when}` : `${formatMoney(left)} left ${when}`}
        </p>
      </CardContent>
    </Card>
  )
}
