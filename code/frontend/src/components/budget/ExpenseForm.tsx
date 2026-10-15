import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { DateField } from '@/components/forms/DateField'
import { Button } from '@/components/kit/button'
import { Input } from '@/components/kit/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/kit/select'
import { Spinner } from '@/components/kit/spinner'
import { localToday } from '@/lib/format/dates'
import { parseMoney } from '@/lib/format/money'
import type { BudgetSummary, CreateExpenseDTO } from '@/types/api'

/** Radix Select cannot hold an empty value, so "no budget" is this sentinel. */
const NO_BUDGET = 'none'

interface ExpenseFormProps {
  budgets: BudgetSummary[]
  onSubmit: (dto: CreateExpenseDTO) => Promise<boolean>
}

/** Quick expense entry: amount, what it was, when (default today), and which budget. */
export function ExpenseForm({ budgets, onSubmit }: ExpenseFormProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [spentOn, setSpentOn] = useState(localToday)
  const [budgetId, setBudgetId] = useState(NO_BUDGET)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cents = parseMoney(amount)
    if (cents === null || cents < 1) return setError('Enter an amount like 12.50')
    if (description.trim().length > 200) return setError('Keep the description under 200 characters')
    if (!spentOn) return setError('Pick the date it was spent')
    setSaving(true)
    const ok = await onSubmit({
      amountCents: cents,
      description: description.trim(),
      spentOn,
      budgetId: budgetId === NO_BUDGET ? null : budgetId,
    })
    setSaving(false)
    if (ok) {
      setAmount('')
      setDescription('')
      setError(undefined)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Amount" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => { setAmount(e.target.value); setError(undefined) }} className="w-1/6 min-w-[12vh]" />
        <Input aria-label="Description" placeholder="What was it?" value={description} onChange={(e) => setDescription(e.target.value)} className="min-w-0 flex-1 basis-1/3" />
        <DateField ariaLabel="Date spent" value={spentOn} onChange={setSpentOn} />
        <Select value={budgetId} onValueChange={setBudgetId}>
          <SelectTrigger aria-label="Budget" className="w-1/5 min-w-[16vh]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BUDGET}>No budget</SelectItem>
            {budgets.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={saving} className="shrink-0">
          {saving ? <Spinner aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Add expense
        </Button>
      </div>
      {error && <p className="px-1 text-xs text-danger-ink">{error}</p>}
    </form>
  )
}
