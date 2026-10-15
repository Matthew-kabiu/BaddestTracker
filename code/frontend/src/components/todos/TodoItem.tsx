import { Check, Pencil, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/kit/button'
import { Checkbox } from '@/components/kit/checkbox'
import { Input } from '@/components/kit/input'
import { Spinner } from '@/components/kit/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import type { Todo, UpdateTodoDTO } from '@/types/api'

export const TODO_TITLE_MAX = 500

interface TodoItemProps {
  todo: Todo
  onUpdate: (id: string, dto: UpdateTodoDTO) => Promise<boolean>
  /** Omit to render a compact, read-and-tick-only row (e.g. on the overview). */
  onRequestDelete?: (todo: Todo) => void
}

/** One row: tick to complete, inline rename, delete (confirmation handled by the page). */
export function TodoItem({ todo, onUpdate, onRequestDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.title)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const editable = onRequestDelete !== undefined

  async function handleRename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return setError('A to-do needs a title')
    if (title.length > TODO_TITLE_MAX) return setError(`Keep it under ${TODO_TITLE_MAX} characters`)
    if (title === todo.title) return setEditing(false)
    setSaving(true)
    const ok = await onUpdate(todo.id, { title })
    setSaving(false)
    if (ok) setEditing(false)
  }

  function cancelEdit() {
    setDraft(todo.title)
    setError(undefined)
    setEditing(false)
  }

  return (
    <li className="group flex min-w-0 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60 motion-reduce:transition-none">
      <Checkbox
        checked={todo.done}
        onCheckedChange={() => void onUpdate(todo.id, { done: !todo.done })}
        aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
      />

      {editing ? (
        <form onSubmit={handleRename} className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(undefined)
              }}
              onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
              aria-label="To-do title"
              aria-invalid={error ? true : undefined}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" size="icon" variant="ghost" aria-label="Save title" disabled={saving}>
              {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Cancel rename" onClick={cancelEdit}>
              <X aria-hidden="true" />
            </Button>
          </div>
          {error && <p className="text-xs text-danger-ink">{error}</p>}
        </form>
      ) : (
        <>
          <span
            className={`min-w-0 flex-1 text-sm break-words transition-colors ${
              todo.done ? 'text-fg-subtle line-through decoration-fg-subtle/60' : 'text-fg'
            }`}
          >
            {todo.title}
          </span>
          {editable && (
            <span className="flex items-center gap-0.5 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    className="hover:text-danger-ink"
                    onClick={() => onRequestDelete(todo)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </span>
          )}
        </>
      )}
    </li>
  )
}
