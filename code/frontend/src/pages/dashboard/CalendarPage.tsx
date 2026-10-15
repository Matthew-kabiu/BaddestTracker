import { Bell, CalendarDays, Plus, Repeat as RepeatIcon, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { EventForm } from '@/components/calendar/EventForm'
import { CalendarDropdown } from '@/components/forms/CalendarDropdown'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { notify } from '@/components/feedback/toast'
import { Button } from '@/components/kit/button'
import { Calendar } from '@/components/kit/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/kit/dialog'
import { Page } from '@/components/layout/Page'
import { useCalendar } from '@/hooks/use-calendar'
import { apiClient } from '@/lib/api/apiClient'
import { formatDay, localToday, toIsoDate } from '@/lib/format/dates'
import type { CalendarEvent, CreateEventDTO, Occurrence } from '@/types/api'

/** null = closed; event null = creating. */
type Editing = { event: CalendarEvent | null } | null

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Every day an occurrence touches (an all-day event's end day is inclusive). */
function daysOf(o: Occurrence): string[] {
  const out: string[] = []
  const last = o.end.slice(0, 10)
  for (let d = fromIso(o.start.slice(0, 10)); toIsoDate(d) <= last && out.length < 400; d.setDate(d.getDate() + 1)) {
    out.push(toIsoDate(d))
  }
  return out
}

function when(o: Occurrence): string {
  if (o.allDay) return 'All day'
  return `${o.start.slice(11, 16)} to ${o.end.slice(11, 16)}`
}

export default function CalendarPage() {
  const [today] = useState(localToday)
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(() => fromIso(today.slice(0, 8) + '01'))
  const [editing, setEditing] = useState<Editing>(null)
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)
  const closeConfirm = useCallback(() => setPendingDelete(null), [])

  // The visible grid shows a few days of the neighbouring months too.
  const from = toIsoDate(new Date(month.getFullYear(), month.getMonth(), -6))
  const to = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 7))
  const cal = useCalendar(from, to)

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    for (const o of cal.occurrences) for (const d of daysOf(o)) map.set(d, [...(map.get(d) ?? []), o])
    return map
  }, [cal.occurrences])
  const busyDays = useMemo(() => [...byDay.keys()].map(fromIso), [byDay])
  const agenda = byDay.get(selected) ?? []
  const [now] = useState(() => Date.now())
  const upcoming = cal.occurrences.filter((o) => new Date(o.endsAt).getTime() >= now).slice(0, 8)

  async function open(o: Occurrence) {
    try {
      setEditing({ event: await apiClient.calendar.get(o.eventId) })
    } catch (err) {
      notify.error(err, "We couldn't open that event.")
    }
  }

  async function save(dto: CreateEventDTO) {
    const ok = editing?.event ? await cal.update(editing.event.id, dto) : await cal.create(dto)
    if (ok) setEditing(null)
    return ok
  }

  const row = (o: Occurrence, withDate: boolean) => (
    <li key={`${o.eventId}-${o.startsAt}`}>
      <Button
        variant="ghost"
        onClick={() => void open(o)}
        className="h-auto w-full items-start justify-start gap-3 rounded-none px-5 py-3 text-left whitespace-normal"
      >
        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-fg">{o.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-normal text-fg-muted">
            {withDate && <span>{formatDay(o.start.slice(0, 10))}</span>}
            <span>{when(o)}</span>
            {o.repeats && <RepeatIcon aria-label="Repeats" className="size-[1.1em]" />}
            {o.reminderMinutes !== null && <Bell aria-label="Has a reminder" className="size-[1.1em]" />}
          </span>
        </span>
      </Button>
    </li>
  )

  if (cal.status === 'error') {
    return (
      <EmptyState
        icon={CalendarDays}
        title="We couldn't load your calendar"
        description="Check your connection and try again."
        action={
          <Button variant="outline" onClick={cal.reload}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <Page title="Calendar" description="Events, repeats and reminders in one place." actions={<><Button onClick={() => setEditing({ event: null })}>
          <Plus aria-hidden="true" />
          New event
        </Button></>}>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="gap-3 overflow-hidden py-5">
          <CardHeader className="border-b [.border-b]:pb-4"><CardTitle className="text-base">A little space for your plans</CardTitle><CardDescription>Select a day to see what's ahead.</CardDescription></CardHeader>
          <Calendar
            mode="single"
            required
            selected={fromIso(selected)}
            onSelect={(d) => d && setSelected(toIsoDate(d))}
            month={month}
            onMonthChange={setMonth}
            // Month and year pickers in the caption, ten years either side of today.
            captionLayout="dropdown"
            components={{ Dropdown: CalendarDropdown }}
            startMonth={new Date(month.getFullYear() - 10, 0)}
            endMonth={new Date(Number(today.slice(0, 4)) + 10, 11)}
            modifiers={{ busy: busyDays, past: { before: fromIso(today) } }}
            modifiersClassNames={{
              // Past days stay clickable (to look back) but read as done.
              past: 'opacity-45',
              busy: 'relative after:absolute after:bottom-[12%] after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
            }}
            className="w-full bg-transparent [--cell-size:min(8.5vw,7vh)]"
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 overflow-hidden border-primary/20 py-0">
            <CardHeader className="border-b border-primary/15 bg-primary-soft px-5 py-5 [.border-b]:pb-5">
              <CardTitle>{selected === today ? 'Today' : formatDay(selected, true)}</CardTitle>
              <CardDescription>
                {agenda.length === 0 ? 'Nothing planned.' : `${agenda.length} event${agenda.length === 1 ? '' : 's'}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {agenda.length === 0 ? (
                <div className="flex justify-center px-5 py-6">
                  {selected < today ? (
                    <p className="text-sm text-fg-subtle">This day has passed.</p>
                  ) : (
                    <Button variant="outline" onClick={() => setEditing({ event: null })}>
                      <Plus aria-hidden="true" />
                      Add an event on this day
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y">{agenda.map((o) => row(o, false))}</ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
              <CardTitle>Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {upcoming.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-fg-muted">Nothing coming up in this view.</p>
              ) : (
                <ul className="divide-y">{upcoming.map((o) => row(o, true))}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[min(92vw,max(40vw,60vh))]">
          <DialogHeader>
            <DialogTitle>{editing?.event ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription>Times are in your time zone. Reminders arrive in the app and on Telegram once linked.</DialogDescription>
          </DialogHeader>
          {editing && (
            <EventForm
              key={editing.event?.id ?? `new-${selected}`}
              event={editing.event}
              defaultDate={selected < today ? today : selected}
              onSubmit={save}
              onRequestDelete={editing.event ? () => setPendingDelete(editing.event) : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this event?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}"${pendingDelete.repeat ? ' and every repeat of it' : ''} will be removed.`
            : ''
        }
        onCancel={closeConfirm}
        onConfirm={async () => {
          if (pendingDelete && (await cal.remove(pendingDelete.id))) {
            closeConfirm()
            setEditing(null)
          }
        }}
      />
    </Page>
  )
}
