import { useReducedMotion } from 'motion/react'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarYAxis } from '@/components/charts/bar-y-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { useMoney } from '@/hooks/use-money'
import type { BudgetSummary } from '@/types/api'

/** BkLit grouped bars compare each budget's spend with its own current-period limit. */
export function BudgetComparisonChart({ budgets }: { budgets: BudgetSummary[] }) {
  const reduceMotion = useReducedMotion()
  const formatMoney = useMoney()
  if (!budgets.length) return <p className="flex min-h-[28dvh] items-center justify-center text-center text-sm text-fg-muted">Create a budget to see spending against your limits.</p>
  const data = budgets.map((budget) => ({
    name: budget.name,
    label: budget.name.length > 16 ? `${budget.name.slice(0, 15)}…` : budget.name,
    Spent: budget.spentCents / 100,
    Limit: budget.amountCents / 100,
  }))
  return (
    <figure className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 text-xs text-fg-muted" aria-hidden="true">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary" />Spent</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-fg-subtle" />Limit</span>
      </div>
      <div role="img" aria-label="Spending compared with budget limits. Exact amounts follow the chart.">
        <BarChart data={data} xDataKey="label" orientation="horizontal" className={data.length <= 4 ? 'h-[32dvh]' : undefined} aspectRatio={`12 / ${Math.max(8, data.length * 2)}`} margin={{ left: 110, right: 20, top: 20, bottom: 20 }} animationDuration={reduceMotion ? 0 : undefined}>
          <Grid horizontal={false} vertical />
          <Bar dataKey="Spent" fill="var(--chart-1)" animate={!reduceMotion} />
          <Bar dataKey="Limit" fill="var(--color-fg-subtle)" animate={!reduceMotion} />
          <BarYAxis />
          <ChartTooltip rows={(point) => [
            { label: `${point.name}: spent`, value: formatMoney(Number(point.Spent) * 100), color: 'var(--chart-1)' },
            { label: 'Limit', value: formatMoney(Number(point.Limit) * 100), color: 'var(--color-fg-subtle)' },
          ]} />
        </BarChart>
      </div>
      <figcaption className="sr-only">{budgets.map((b) => `${b.name}: ${formatMoney(b.spentCents)} spent of ${formatMoney(b.amountCents)} allowed in its current budget period.`).join(' ')}</figcaption>
    </figure>
  )
}
