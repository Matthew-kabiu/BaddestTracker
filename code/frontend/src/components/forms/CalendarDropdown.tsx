import type { ChangeEvent } from 'react'
import type { DropdownProps } from 'react-day-picker'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/kit/select'

/**
 * Month / year picker for the kit Calendar's caption: the kit Select in place of the browser's
 * native <select>. react-day-picker expects a change event, so one is built from the value.
 */
export function CalendarDropdown({ options = [], value, onChange, 'aria-label': ariaLabel, disabled }: DropdownProps) {
  return (
    <Select
      value={value === undefined ? undefined : String(value)}
      disabled={disabled}
      onValueChange={(next) => onChange?.({ target: { value: next } } as ChangeEvent<HTMLSelectElement>)}
    >
      {/* relative z-10: the calendar's prev/next bar is laid over the caption and would take the click. */}
      <SelectTrigger size="sm" aria-label={ariaLabel} className="relative z-10 gap-1 font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-[40vh]">
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
