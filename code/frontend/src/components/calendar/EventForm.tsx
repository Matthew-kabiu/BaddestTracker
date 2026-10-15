import { Check, Trash2 } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import { DateField } from '@/components/forms/DateField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Field, FieldError, FieldLabel } from '@/components/kit/field'
import { Input } from '@/components/kit/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/kit/select'
import { Spinner } from '@/components/kit/spinner'
import { Switch } from '@/components/kit/switch'
import { Textarea } from '@/components/kit/textarea'
import { localToday } from '@/lib/format/dates'
import type { CalendarEvent, CreateEventDTO, RepeatFreq } from '@/types/api'

const REPEATS: { value: 'none' | RepeatFreq; label: string; unit: string }[] = [
  { value: 'none', label: 'Does not repeat', unit: '' },
  { value: 'daily', label: 'Daily', unit: 'days' },
  { value: 'weekly', label: 'Weekly', unit: 'weeks' },
  { value: 'monthly', label: 'Monthly', unit: 'months' },
  { value: 'yearly', label: 'Yearly', unit: 'years' },
]

const REMINDERS: { value: string; label: string }[] = [
  { value: 'none', label: 'No reminder' },
  { value: '0', label: 'At the start' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

/** The browser's IANA zone; events keep the zone they were created in. */
function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

interface EventFormProps {
  /** null = new event. */
  event: CalendarEvent | null
  /** Day picked in the calendar, used as the default start for a new event. */
  defaultDate: string
  onSubmit: (dto: CreateEventDTO) => Promise<boolean>
  onRequestDelete?: () => void
}

type Ends = 'never' | 'on' | 'after'

/** Create or edit a series: title, all-day or timed, repeat rule, reminder, notes. */
export function EventForm({ event, defaultDate, onSubmit, onRequestDelete }: EventFormProps) {
  const ids = { allDay: useId(), repeat: useId(), reminder: useId(), notes: useId(), ends: useId() }
  const r = event?.repeat
  const [title, setTitle] = useState(event?.title ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [startDate, setStartDate] = useState(event?.start.slice(0, 10) ?? defaultDate)
  const [startTime, setStartTime] = useState(event && !event.allDay ? event.start.slice(11, 16) : '09:00')
  const [endDate, setEndDate] = useState(event?.end.slice(0, 10) ?? defaultDate)
  const [endTime, setEndTime] = useState(event && !event.allDay ? event.end.slice(11, 16) : '10:00')
  const [freq, setFreq] = useState<'none' | RepeatFreq>(r?.freq ?? 'none')
  const [every, setEvery] = useState(String(r?.interval ?? 1))
  const [ends, setEnds] = useState<Ends>(r?.until ? 'on' : r?.count ? 'after' : 'never')
  const [until, setUntil] = useState(r?.until ?? '')
  const [count, setCount] = useState(String(r?.count ?? 10))
  const [reminder, setReminder] = useState(event?.reminderMinutes == null ? 'none' : String(event.reminderMinutes))
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const unit = REPEATS.find((x) => x.value === freq)?.unit ?? ''

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const start = `${startDate}T${allDay ? '00:00' : startTime}:00`
    const end = `${endDate}T${allDay ? '00:00' : endTime}:00`
    const everyN = Number(every)
    const times = Number(count)
    if (!title.trim()) return setError('Give the event a title')
    if (!startDate || !endDate || (!allDay && (!startTime || !endTime))) return setError('Pick when it starts and ends')
    if (!event && startDate < localToday()) return setError('Events cannot start on a past day')
    if (end < start) return setError('The end must be after the start')
    if (freq !== 'none' && (!Number.isInteger(everyN) || everyN < 1 || everyN > 365)) return setError('Repeat every 1 to 365')
    if (freq !== 'none' && ends === 'on' && (!until || until < startDate)) return setError('The repeat must end on or after the first day')
    if (freq !== 'none' && ends === 'after' && (!Number.isInteger(times) || times < 1 || times > 1000)) return setError('End after 1 to 1000 times')
    setError(undefined)
    setSaving(true)
    await onSubmit({
      title: title.trim(),
      notes,
      allDay,
      start,
      end,
      timezone: event?.timezone ?? browserZone(),
      repeat:
        freq === 'none'
          ? null
          : { freq, interval: everyN, until: ends === 'on' ? until : null, count: ends === 'after' ? times : null },
      reminderMinutes: reminder === 'none' ? null : Number(reminder),
    })
    setSaving(false)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />

      <Field orientation="horizontal">
        <Switch id={ids.allDay} checked={allDay} onCheckedChange={setAllDay} />
        <FieldLabel htmlFor={ids.allDay} className="font-normal">
          All day
        </FieldLabel>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Starts"
          // A new event starts today or later; an existing series keeps its original start.
          min={event ? undefined : localToday()}
          value={startDate}
          onChange={(d) => {
            setStartDate(d)
            if (endDate < d) setEndDate(d)
          }}
        />
        {!allDay ? <TextField label="At" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /> : <span />}
        <DateField label="Ends" min={startDate} value={endDate} onChange={setEndDate} />
        {!allDay ? <TextField label="At" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /> : <span />}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={ids.repeat}>Repeat</FieldLabel>
          <Select value={freq} onValueChange={(v) => setFreq(v as 'none' | RepeatFreq)}>
            <SelectTrigger id={ids.repeat} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPEATS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.reminder}>Reminder</FieldLabel>
          <Select value={reminder} onValueChange={setReminder}>
            <SelectTrigger id={ids.reminder} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDERS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {freq !== 'none' && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm">
            Every
            <Input aria-label="Repeat interval" type="number" min={1} max={365} value={every} onChange={(e) => setEvery(e.target.value)} className="w-[9vh]" />
            {unit}
          </label>
          <Field className="w-auto flex-1">
            <FieldLabel htmlFor={ids.ends}>Ends</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={ends} onValueChange={(v) => setEnds(v as Ends)}>
                <SelectTrigger id={ids.ends} className="min-w-[16vh]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="on">On a date</SelectItem>
                  <SelectItem value="after">After a number of times</SelectItem>
                </SelectContent>
              </Select>
              {ends === 'on' && <DateField ariaLabel="Repeat until" min={startDate} value={until} onChange={setUntil} placeholder="End date" />}
              {ends === 'after' && (
                <label className="flex items-center gap-2 text-sm">
                  <Input aria-label="Number of times" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} className="w-[10vh]" />
                  times
                </label>
              )}
            </div>
          </Field>
        </div>
      )}

      <Field>
        <FieldLabel htmlFor={ids.notes}>Notes</FieldLabel>
        <Textarea id={ids.notes} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} className="min-h-[12vh]" />
      </Field>

      {error && <FieldError>{error}</FieldError>}
      {event?.repeat && <p className="text-xs text-fg-subtle">Changes apply to every occurrence of this event.</p>}

      <div className="flex justify-between gap-2">
        {onRequestDelete ? (
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
          {event ? 'Save' : 'Add event'}
        </Button>
      </div>
    </form>
  )
}
