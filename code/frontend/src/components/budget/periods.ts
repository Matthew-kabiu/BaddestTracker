import type { BudgetPeriod } from '@/types/api'

/** Picker order and wording. Recurring periods follow the calendar; weeks start on Monday. */
export const PERIODS: { value: BudgetPeriod; label: string; window: string }[] = [
  { value: 'daily', label: 'Daily', window: 'today' },
  { value: 'weekly', label: 'Weekly', window: 'this week' },
  { value: 'monthly', label: 'Monthly', window: 'this month' },
  { value: 'quarterly', label: 'Quarterly', window: 'this quarter' },
  { value: 'yearly', label: 'Yearly', window: 'this year' },
  { value: 'custom', label: 'Custom dates', window: 'in this range' },
]

export function periodInfo(period: BudgetPeriod) {
  return PERIODS.find((p) => p.value === period) ?? PERIODS[2]
}
