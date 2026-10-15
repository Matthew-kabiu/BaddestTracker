import { CheckCircle2, ListTodo, Plus, RotateCcw, Target } from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { TODO_TITLE_MAX, TodoItem } from '@/components/todos/TodoItem'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Button } from '@/components/kit/button'
import { Input } from '@/components/kit/input'
import { Card } from '@/components/kit/card'
import { DashboardMetric } from '@/components/layout/DashboardMetric'
import { Spinner } from '@/components/kit/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/kit/tabs'
import { Page } from '@/components/layout/Page'
import { useTodos } from '@/hooks/use-todos'
import type { Todo } from '@/types/api'

type Filter = 'all' | 'open' | 'done'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
]

export default function TodosPage() {
  const { todos, status, reload, create, update, remove } = useTodos()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)
  const closeDialog = useCallback(() => setPendingDelete(null), [])

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Give your to-do a title')
    if (trimmed.length > TODO_TITLE_MAX) return setError(`Keep it under ${TODO_TITLE_MAX} characters`)
    setAdding(true)
    const ok = await create(trimmed)
    setAdding(false)
    if (ok) setTitle('')
  }

  const done = todos.filter((t) => t.done).length
  const open = todos.length - done
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0
  const visible = todos.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
  const counts: Record<Filter, number> = { all: todos.length, open, done }

  return (
    <Page title="Your to-dos" description="Clear your head. Make a little progress.">
      <section aria-label="Task summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardMetric label="Still to do" value={status === 'ready' ? open : '-'} detail="Ready when you are" icon={ListTodo} accent />
        <DashboardMetric label="Completed" value={status === 'ready' ? done : '-'} detail="A little less on your plate" icon={CheckCircle2} />
        <DashboardMetric label="Completion" value={status === 'ready' ? `${pct}%` : '-'} detail="Across your whole list" icon={Target} />
      </section>
      <Card className="gap-0 overflow-hidden py-0">
        <form noValidate onSubmit={handleAdd} className="flex flex-col gap-3 border-b border-line bg-muted/30 p-5">
          <label htmlFor="new-todo" className="text-sm font-medium">What needs to get done?</label>
          <div className="flex items-center gap-3">
            <Input
              id="new-todo"
              name="title"
              placeholder="Add a to-do and press Enter"
              value={title}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-todo-error' : undefined}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(undefined)
              }}
              className="h-11 min-w-0 flex-1 rounded-lg bg-surface"
            />
            <Button type="submit" disabled={adding} className="h-11 shrink-0">
              {adding ? <Spinner aria-hidden="true" /> : <Plus aria-hidden="true" />}
              Add
            </Button>
          </div>
          {error && (
            <p id="new-todo-error" className="px-1 text-xs text-danger-ink">
              {error}
            </p>
          )}
        </form>

        {status === 'ready' && todos.length > 0 && (
          <div className="border-b border-line px-5 py-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList aria-label="Filter to-dos" variant="line">
                {FILTERS.map(({ value, label }) => (
                  <TabsTrigger key={value} value={value}>
                    {label}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-fg-muted tabular-nums">{counts[value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {status === 'loading' && <LoadingState label="Loading your to-dos…" />}

        {status === 'error' && (
          <EmptyState
            icon={ListTodo}
            title="We couldn't load your to-dos"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={reload}>
                <RotateCcw aria-hidden="true" />
                Try again
              </Button>
            }
          />
        )}

        {status === 'ready' && todos.length === 0 && (
          <EmptyState icon={ListTodo} title="A clear list" description="Add your first to-do above to get going." />
        )}

        {status === 'ready' && todos.length > 0 && visible.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-fg-muted">
            {filter === 'done' ? 'Nothing finished yet.' : 'Everything is done. Nice.'}
          </p>
        )}

        {visible.length > 0 && (
          <ul className="divide-y divide-line">
            {visible.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onUpdate={update} onRequestDelete={setPendingDelete} />
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this to-do?"
        description={pendingDelete ? `"${pendingDelete.title}" will be removed permanently.` : ''}
        onCancel={closeDialog}
        onConfirm={async () => {
          if (pendingDelete && (await remove(pendingDelete.id))) closeDialog()
        }}
      />
    </Page>
  )
}
