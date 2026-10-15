import { CalendarDays } from 'lucide-react'
import { useId, useState } from 'react'

import { CalendarDropdown } from '@/components/forms/CalendarDropdown'
import { Button } from '@/components/kit/button'
import { Calendar } from '@/components/kit/calendar'
import { Field, FieldLabel } from '@/components/kit/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/kit/popover'
import { formatDay, toIsoDate } from '@/lib/format/dates'

function fromIso(iso: string): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface DateFieldProps {
  /** YYYY-MM-DD, or '' for none. */
  value: string
  onChange: (iso: string) => void
  /** Visible label; omit and pass `ariaLabel` for an inline field. */
  label?: string
  ariaLabel?: string
  placeholder?: string
  className?: string
  /** Earliest selectable day (YYYY-MM-DD); earlier days are disabled. */
  min?: string
}

/** Date picker from kit parts (Popover + Calendar) in place of the browser's date input. */
export function DateField({ value, onChange, label, ariaLabel, placeholder = 'Pick a date', className = '', min }: DateFieldProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selected = fromIso(value)
  const minDate = min ? fromIso(min) : undefined
  // Read the clock once per mount, not on every render.
  const [year] = useState(() => new Date().getFullYear())

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          aria-label={label ? undefined : ariaLabel}
          className={`justify-start font-normal ${value ? '' : 'text-fg-subtle'} ${className}`}
        >
          <CalendarDays aria-hidden="true" />
          {value ? formatDay(value, true) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(year - 10, 0)}
          endMonth={new Date(year + 10, 11)}
          components={{ Dropdown: CalendarDropdown }}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(d) => {
            if (d) onChange(toIsoDate(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )

  if (!label) return picker
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {picker}
    </Field>
  )
}
