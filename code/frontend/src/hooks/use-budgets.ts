import { useCallback, useEffect, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import type { LoadStatus } from '@/hooks/use-todos'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type {
  BudgetSummary,
  CreateBudgetDTO,
  CreateExpenseDTO,
  Expense,
  UpdateBudgetDTO,
} from '@/types/api'

/** These change a budget's spend, so the budget page refetches on any of them. */
const AFFECTS_BUDGETS = ['budget.', 'expense.', 'shopping.']

/**
 * Budgets (with spend for the window containing `today`) and the expenses between `from` and `to`.
 * Both refetch together: an expense changes a budget's total.
 */
export function useBudgets(today: string, from: string, to: string) {
  const [budgets, setBudgets] = useState<BudgetSummary[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([apiClient.budgets.list(today), apiClient.expenses.list(from, to)])
      .then(([b, e]) => {
        if (cancelled) return
        setBudgets(b)
        setExpenses(e)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        notify.error(err, "We couldn't load your budgets.")
      })
    return () => {
      cancelled = true
    }
  }, [today, from, to, reloadKey])

  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'resync' || AFFECTS_BUDGETS.some((p) => event.type.startsWith(p))) {
        setReloadKey((k) => k + 1)
      }
    }, []),
  )

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])
  const reload = useCallback(() => {
    setStatus('loading')
    refresh()
  }, [refresh])

  /** Run a write, then refetch both lists (spend is computed server-side). */
  const run = useCallback(
    async (work: () => Promise<unknown>, failure: string, success?: string) => {
      try {
        await work()
        refresh()
        if (success) notify.success(success)
        return true
      } catch (err) {
        notify.error(err, failure)
        return false
      }
    },
    [refresh],
  )

  return {
    budgets,
    expenses,
    status,
    reload,
    createBudget: (dto: CreateBudgetDTO) =>
      run(() => apiClient.budgets.create(dto), "We couldn't create that budget.", 'Budget created.'),
    updateBudget: (id: string, dto: UpdateBudgetDTO) =>
      run(() => apiClient.budgets.update(id, dto), "We couldn't save that budget.", 'Budget updated.'),
    removeBudget: (id: string) =>
      run(() => apiClient.budgets.remove(id), "We couldn't delete that budget.", 'Budget deleted.'),
    createExpense: (dto: CreateExpenseDTO) =>
      run(() => apiClient.expenses.create(dto), "We couldn't add that expense."),
    removeExpense: (id: string) =>
      run(() => apiClient.expenses.remove(id), "We couldn't delete that expense.", 'Expense deleted.'),
  }
}
