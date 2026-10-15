import { useReducedMotion } from 'motion/react'

import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { useMoney } from '@/hooks/use-money'

export interface SpendingPoint {
  /** Axis label, e.g. "12". */
  label: string
  /** Minor units (cents). */
  cents: number
}

interface SpendingChartProps {
  points: SpendingPoint[]
  /** The period, read with the totals, e.g. "in October". */
  caption: string
  loading?: boolean
}

/**
 * Project wrapper around the BkLit bar chart (the only chart source, see docs/DESIGN.md §9).
 * Pages pass data; this owns the loading, empty, accessible and reduced-motion behaviour.
 */
export function SpendingChart({ points, caption, loading = false }: SpendingChartProps) {
  const formatMoney = useMoney()
  const reduceMotion = useReducedMotion()
  const total = points.reduce((sum, p) => sum + p.cents, 0)
  const peak = points.reduce((best, p) => (p.cents > best.cents ? p : best), { label: '', cents: 0 })

  if (!loading && total === 0) {
    return <p className="flex min-h-[28dvh] items-center justify-center py-10 text-center text-sm text-fg-muted">No spending recorded {caption} yet. Log an expense to start your chart.</p>
  }

  // The chart shows major units; tooltips and the summary format them.
  const data = points.map((p) => ({ day: p.label, spent: p.cents / 100 }))
  const summary = `Spending per day ${caption}: ${formatMoney(total)} in total, highest ${formatMoney(peak.cents)} on day ${peak.label}.`

  return (
    <figure className="flex flex-col gap-2">
      <div role="img" aria-label={loading ? `Loading spending ${caption}` : summary} className="w-full">
        <BarChart
          data={data}
          xDataKey="day"
          aspectRatio="2 / 1"
          status={loading ? 'loading' : 'ready'}
          animationDuration={reduceMotion ? 0 : undefined}
        >
          <Grid horizontal />
          <Bar dataKey="spent" animate={!reduceMotion} />
          <BarXAxis />
          <ChartTooltip rows={(point) => [{ label: 'Spent', value: formatMoney(Number(point.spent) * 100), color: 'var(--chart-1)' }]} />
        </BarChart>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}
