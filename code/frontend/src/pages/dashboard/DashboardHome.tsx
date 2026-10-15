import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ListTodo, NotebookPen, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { LoadingState } from '@/components/feedback/LoadingState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Page } from '@/components/layout/Page'
import { DashboardMetric } from '@/components/layout/DashboardMetric'
import { NAV_ITEMS } from '@/components/layout/nav'
import { TodoItem } from '@/components/todos/TodoItem'
import { Button } from '@/components/kit/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/kit/card'
import { Input } from '@/components/kit/input'
import { Progress } from '@/components/kit/progress'
import { Spinner } from '@/components/kit/spinner'
import { useNotes } from '@/hooks/use-notes'
import { useTodos } from '@/hooks/use-todos'
import { useSession } from '@/lib/auth/client'
import { PAGE_ROUTES } from '@/lib/routes'

/** Modules with a working page today; the rest are listed as "coming next". */
const LIVE: readonly string[] = [
  PAGE_ROUTES.dashboard.root,
  PAGE_ROUTES.dashboard.todos,
  PAGE_ROUTES.dashboard.notes,
  PAGE_ROUTES.dashboard.shopping,
  PAGE_ROUTES.dashboard.budget,
  PAGE_ROUTES.dashboard.calendar,
  PAGE_ROUTES.dashboard.vault,
]

/** Read the clock once per mount (useState initialiser, not called during render). */
function today() {
  const now = new Date()
  const hour = now.getHours()
  return {
    hello: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    date: now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

function timeAgo(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const viewAll = 'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-primary-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring'

/** Overview: today at a glance, built from the user's real to-dos and notes. */
export default function DashboardHome() {
  const { data: session } = useSession()
  const [{ hello, date }] = useState(today)
  const [now] = useState(() => Date.now())
  const todos = useTodos()
  const notes = useNotes()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const firstName = session?.user.name?.trim().split(/\s+/)[0]
  const open = todos.todos.filter((t) => !t.done)
  const done = todos.todos.length - open.length
  const pct = todos.todos.length ? Math.round((done / todos.todos.length) * 100) : 0
  const soon = NAV_ITEMS.filter((n) => !LIVE.includes(n.href))

  async function quickAdd(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setAdding(true)
    if (await todos.create(title)) setDraft('')
    setAdding(false)
  }

  const stats = [
    { label: 'To make happen', value: open.length, icon: ListTodo, detail: 'Open tasks in your workspace', status: todos.status, accent: true },
    { label: 'Off your mind', value: done, icon: CheckCircle2, detail: 'Completed tasks, one at a time', status: todos.status },
    { label: 'Ideas collected', value: notes.notes.length, icon: NotebookPen, detail: 'Notes saved for later', status: notes.status },
  ]

  return (
    <Page title={`${hello}${firstName ? `, ${firstName}` : ''}.`} description="A little clarity for everything on your plate." actions={
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs text-fg-muted">
        <CalendarDays aria-hidden="true" className="size-[1.2em]" />{date}
      </span>
    }>
      <Card className="gap-0 overflow-hidden rounded-3xl! border-primary/20 bg-primary-soft py-0">
        <CardContent className="grid grid-cols-1 gap-7 p-6 lg:grid-cols-[3fr_2fr] lg:items-center lg:p-8">
          <div className="flex min-w-0 flex-col gap-4">
            <span className="flex items-center gap-2 text-xs font-medium text-primary-ink"><Sparkles aria-hidden="true" className="size-[1.2em]" />Make room for what matters</span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance">One thing at a time.</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">Capture it here. Get it off your mind.</p>
            </div>
        <form onSubmit={quickAdd} className="flex w-full items-center gap-2">
          <label htmlFor="quick-add" className="sr-only">
            Quick add a to-do
          </label>
          <Input
            id="quick-add"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="What's your next small win?"
            className="h-11 min-w-0 flex-1 rounded-lg border-primary/20 bg-surface shadow-xs"
          />
          <Button type="submit" className="h-11" disabled={adding || !draft.trim()}>
            {adding ? <Spinner aria-hidden="true" /> : <Plus aria-hidden="true" />}
            <span>Add<span className="hidden sm:inline"> to-do</span></span>
          </Button>
        </form>
          </div>
          <div className="flex flex-col gap-4 border-t border-primary/15 pt-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-fg-muted">Your progress</span>
              <CheckCircle2 aria-hidden="true" className="size-[1.3em] text-primary-ink" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl leading-none font-semibold tracking-tight text-primary-ink tabular-nums">{todos.status === 'ready' ? pct : '-'}<span className="text-xl">%</span></span>
              <span className="text-sm text-fg-muted">complete</span>
            </div>
            {todos.status === 'ready' && <Progress value={pct} aria-label="All tasks completed" className="h-1.5 bg-primary/15" />}
            <p className="text-xs text-fg-muted">{todos.status === 'ready' ? todos.todos.length ? `${done} of ${todos.todos.length} tasks finished. Every bit counts.` : 'Your next chapter starts with a single task.' : todos.status === 'loading' ? 'Getting your latest progress...' : 'Progress is temporarily unavailable.'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <section aria-label="At a glance" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon, detail, status, accent }) => (
          <DashboardMetric key={label} label={label} value={status === 'ready' ? String(value).padStart(2, '0') : '-'} icon={icon} detail={detail} accent={accent} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Up next: live, tickable */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-3">
          <CardHeader className="border-b px-5 py-5 [.border-b]:pb-5">
            <CardTitle className="flex items-center gap-2 text-base"><ListTodo aria-hidden="true" className="size-[1.1em] text-primary-ink" />Up next</CardTitle>
            <CardAction>
              <Link to={PAGE_ROUTES.dashboard.todos} className={viewAll}>
                All to-dos <ArrowRight aria-hidden="true" className="size-[1em]" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
          {todos.status === 'loading' ? (
            <LoadingState label="Loading to-dos…" />
          ) : todos.status === 'error' ? (
            <EmptyState icon={ListTodo} title="Your tasks couldn't load" description="Try connecting again." action={<Button variant="outline" onClick={todos.reload}><RotateCcw aria-hidden="true" />Try again</Button>} />
          ) : open.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={todos.todos.length ? 'A little breathing room.' : 'Start with something small.'} description={todos.todos.length ? 'Everything on your list is complete.' : 'Add a task above. Your next steps will live here.'} />
          ) : (
            <ul className="divide-y divide-line">
              {open.slice(0, 6).map((todo) => (
                <TodoItem key={todo.id} todo={todo} onUpdate={todos.update} />
              ))}
            </ul>
          )}
          </CardContent>
        </Card>

        {/* Recent notes */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b px-5 py-5 [.border-b]:pb-5">
            <CardTitle className="flex items-center gap-2 text-base"><NotebookPen aria-hidden="true" className="size-[1.1em] text-primary-ink" />Recent notes</CardTitle>
            <CardAction>
              <Link to={PAGE_ROUTES.dashboard.notes} className={viewAll}>
                All notes <ArrowRight aria-hidden="true" className="size-[1em]" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
          {notes.status === 'loading' ? (
            <LoadingState label="Loading notes…" />
          ) : notes.status === 'error' ? (
            <EmptyState icon={NotebookPen} title="Your notes couldn't load" description="Try connecting again." action={<Button variant="outline" onClick={notes.reload}><RotateCcw aria-hidden="true" />Try again</Button>} />
          ) : notes.notes.length === 0 ? (
            <EmptyState icon={NotebookPen} title="Good ideas belong here." description="A thought, a list, a plan. Make it a note." action={<Link to={PAGE_ROUTES.dashboard.notes} className={viewAll}>Write your first note <ArrowRight aria-hidden="true" className="size-[1em]" /></Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {notes.notes.slice(0, 4).map((note) => (
                <li key={note.id}>
                  <Link
                    to={PAGE_ROUTES.dashboard.notes}
                    className="group flex flex-col gap-2 px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted motion-reduce:transition-none"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-fg">{note.title}</span>
                      <ArrowUpRight aria-hidden="true" className="size-[1em] shrink-0 text-fg-subtle group-hover:text-primary-ink" />
                    </span>
                    {note.body && <span className="line-clamp-2 text-sm text-fg-muted">{note.body}</span>}
                    <span className="text-xs text-fg-subtle">Edited {timeAgo(note.updatedAt, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </CardContent>
        </Card>
      </div>

      {/* What's coming: compact, honest */}
      {soon.length > 0 && <section aria-labelledby="soon-heading" className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
        <h3 id="soon-heading" className="text-xs font-medium text-fg-muted">
          Coming next
        </h3>
        <ul className="flex flex-wrap gap-2">
          {soon.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link
                to={href}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-fg-muted outline-none transition-colors hover:border-line-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                <Icon aria-hidden="true" className="size-[1em]" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>}
    </Page>
  )
}
