import { ArrowUpRight, Plus, ReceiptText, RotateCcw, Trash2, Wallet } from 'lucide-react'
import { DashboardMetric } from '@/components/layout/DashboardMetric'
import { Page } from '@/components/layout/Page'
import { useCallback, useMemo, useState } from 'react'

import { BudgetCard } from '@/components/budget/BudgetCard'
import { BudgetForm } from '@/components/budget/BudgetForm'
import { ExpenseForm } from '@/components/budget/ExpenseForm'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { BudgetComparisonChart } from '@/components/charts/BudgetComparisonChart'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/kit/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { useBudgets } from '@/hooks/use-budgets'
import { formatDay, localToday, monthRange } from '@/lib/format/dates'
import { useMoney } from '@/hooks/use-money'
import type { BudgetSummary } from '@/types/api'

export default function BudgetPage() {
  const formatMoney = useMoney()
  const [today] = useState(localToday)
  const { from, to } = monthRange(today)
  const b = useBudgets(today, from, to)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BudgetSummary | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BudgetSummary | null>(null)
  const closeDialog = useCallback(() => setPendingDelete(null), [])

  const monthName = new Date(`${from}T00:00:00`).toLocaleDateString(undefined, { month: 'long' })
  const budgetName = new Map(b.budgets.map((x) => [x.id, x.name]))
  const monthTotal = b.expenses.reduce((sum, e) => sum + e.amountCents, 0)

  // One bar per day of the month so far.
  const points = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const e of b.expenses) byDay.set(e.spentOn, (byDay.get(e.spentOn) ?? 0) + e.amountCents)
    const lastDay = Number(today.slice(8, 10))
    return Array.from({ length: lastDay }, (_, i) => {
      const day = `${from.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
      return { label: String(i + 1), cents: byDay.get(day) ?? 0 }
    })
  }, [b.expenses, from, today])
  const hasDailySpending = points.some((point) => point.cents > 0)
  const hasBudgets = b.budgets.length > 0

  if (b.status === 'loading') return <LoadingState label="Loading your budgets…" />
  if (b.status === 'error') {
    return (
      <EmptyState
        icon={Wallet}
        title="We couldn't load your budgets"
        description="Check your connection and try again."
        action={
          <Button variant="outline" onClick={b.reload}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <Page title="Budget" description={b.budgets.length === 0 ? 'Set an amount for any period and track what you spend.' : `${formatMoney(monthTotal)} in expenses in ${monthName}`} actions={<>{!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New budget
          </Button>
        )}</>}>
      <section aria-label="Budget summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardMetric label={`Spent in ${monthName}`} value={formatMoney(monthTotal)} detail="Recorded expenses this month" icon={ArrowUpRight} accent />
        <DashboardMetric label="Your budgets" value={b.budgets.length} detail="Spending plans you've created" icon={Wallet} />
        <DashboardMetric label="Expenses logged" value={b.expenses.length} detail="Every expense adds clarity" icon={ReceiptText} />
      </section>
      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New budget</CardTitle>
            <CardDescription>Daily to yearly follow the calendar. Custom covers dates you choose.</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetForm onSubmit={b.createBudget} onCancel={() => setCreating(false)} />
          </CardContent>
        </Card>
      )}

      {(hasDailySpending || hasBudgets) && <section aria-label="Spending insights" className={`grid min-w-0 grid-cols-1 gap-5 ${hasDailySpending && hasBudgets ? 'xl:grid-cols-2' : ''}`}>
        {hasDailySpending && <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Daily spending</CardTitle>
            <CardDescription>{monthName}, one day at a time. Logged expenses only.</CardDescription>
          </CardHeader>
          <CardContent><SpendingChart points={points} caption={`in ${monthName}`} /></CardContent>
        </Card>}
        {hasBudgets && <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Spending vs. limits</CardTitle>
            <CardDescription>Each budget's current period, including linked shopping.</CardDescription>
          </CardHeader>
          <CardContent><BudgetComparisonChart budgets={b.budgets} /></CardContent>
        </Card>}
      </section>}

      {b.budgets.length === 0 && !creating ? (
        <Card>
          <EmptyState icon={Wallet} title="No budgets yet" description="Create one for groceries, eating out, a trip, anything." />
        </Card>
      ) : (
        <section aria-label="Budgets" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {b.budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} onRequestEdit={() => setEditing(budget)} onRequestDelete={() => setPendingDelete(budget)} />
          ))}
        </section>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-4 border-b bg-muted/30 p-5">
          <h2 className="text-base font-semibold tracking-tight">Expense journal</h2>
          <ExpenseForm budgets={b.budgets} onSubmit={b.createExpense} />
        </div>
        <CardContent className="px-0">
          {b.expenses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-fg-muted">No expenses in {monthName} yet.</p>
          ) : (
            <ul aria-label={`Expenses in ${monthName}`} className="divide-y">
              {b.expenses.map((e) => (
                <li key={e.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-muted/60">
                  <span className="w-[8vh] shrink-0 text-sm text-fg-subtle">{formatDay(e.spentOn)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-fg">{e.description || 'Expense'}</span>
                    <span className="text-xs text-fg-subtle">{e.budgetId ? (budgetName.get(e.budgetId) ?? 'Budget') : 'No budget'}</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatMoney(e.amountCents)}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Delete expense" className="opacity-100 hover:text-danger-ink sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100" onClick={() => void b.removeExpense(e.id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete expense</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[min(92vw,max(48vw,65vh))]">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>Update your spending plan. Existing expenses stay linked to this budget.</DialogDescription>
          </DialogHeader>
          {editing && <BudgetForm
            key={editing.id}
            budget={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(dto) => b.updateBudget(editing.id, {
              ...dto,
              customStart: dto.period === 'custom' ? dto.customStart : null,
              customEnd: dto.period === 'custom' ? dto.customEnd : null,
            })}
          />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this budget?"
        description={pendingDelete ? `"${pendingDelete.name}" will be removed. Its expenses stay, without a budget.` : ''}
        onCancel={closeDialog}
        onConfirm={async () => {
          if (pendingDelete && (await b.removeBudget(pendingDelete.id))) closeDialog()
        }}
      />
    </Page>
  )
}
