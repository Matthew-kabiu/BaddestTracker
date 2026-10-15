import { Check, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import { PERIODS } from '@/components/budget/periods'
import { DateField } from '@/components/forms/DateField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Checkbox } from '@/components/kit/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/kit/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/kit/select'
import { Spinner } from '@/components/kit/spinner'
import { parseMoney } from '@/lib/format/money'
import type { Budget, BudgetPeriod, CreateBudgetDTO } from '@/types/api'

interface BudgetFormProps {
  budget?: Budget
  onSubmit: (dto: CreateBudgetDTO) => Promise<boolean>
  onCancel: () => void
}

type Errors = Partial<Record<'name' | 'amount' | 'range', string>>

/** Shared create/edit form. The parent keys edits by budget ID to reset the draft. */
export function BudgetForm({ budget, onSubmit, onCancel }: BudgetFormProps) {
  const periodId = useId()
  const shoppingId = useId()
  const [name, setName] = useState(budget?.name ?? '')
  const [amount, setAmount] = useState(budget ? (budget.amountCents / 100).toFixed(2) : '')
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'monthly')
  const [start, setStart] = useState(budget?.customStart ?? '')
  const [end, setEnd] = useState(budget?.customEnd ?? '')
  const [includesShopping, setIncludesShopping] = useState(budget?.includesShopping ?? false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cents = parseMoney(amount)
    const next: Errors = {}
    if (!name.trim()) next.name = 'Name the budget, e.g. Groceries'
    else if (name.trim().length > 100) next.name = 'Keep it under 100 characters'
    if (cents === null || cents < 1) next.amount = 'Enter an amount like 250 or 250.00'
    if (period === 'custom' && (!start || !end)) next.range = 'Pick a start and an end date'
    else if (period === 'custom' && start > end) next.range = 'The start must be on or before the end'
    setErrors(next)
    if (Object.keys(next).length || cents === null) return
    setSaving(true)
    const ok = await onSubmit({
      name: name.trim(),
      amountCents: cents,
      period,
      includesShopping,
      ...(period === 'custom' ? { customStart: start, customEnd: end } : {}),
    })
    setSaving(false)
    if (ok) onCancel()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Groceries" />
        <TextField label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} placeholder="250.00" />
        <Field>
          <FieldLabel htmlFor={periodId}>Period</FieldLabel>
          <Select value={period} onValueChange={(v) => setPeriod(v as BudgetPeriod)}>
            <SelectTrigger id={periodId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {period === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField label="Starts" value={start} onChange={setStart} />
            <DateField label="Ends" value={end} onChange={setEnd} />
          </div>
          {errors.range && <FieldError>{errors.range}</FieldError>}
        </div>
      )}
      <Field orientation="horizontal">
        <Checkbox id={shoppingId} checked={includesShopping} onCheckedChange={(v) => setIncludesShopping(v === true)} />
        <FieldLabel htmlFor={shoppingId} className="font-normal">
          Count bought shopping items against this budget
        </FieldLabel>
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X aria-hidden="true" />
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
          {budget ? 'Save changes' : 'Create budget'}
        </Button>
      </div>
    </form>
  )
}
