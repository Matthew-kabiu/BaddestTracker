import { Check, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Field, FieldError, FieldLabel } from '@/components/kit/field'
import { Spinner } from '@/components/kit/spinner'
import { Textarea } from '@/components/kit/textarea'
import type { CreateNoteDTO, Note } from '@/types/api'

export const NOTE_TITLE_MAX = 300
export const NOTE_BODY_MAX = 100_000

interface NoteEditorProps {
  /** null = composing a new note. Remount with a new `key` to reset the draft. */
  note: Note | null
  onSave: (dto: CreateNoteDTO) => Promise<unknown>
  onRequestDelete?: () => void
}

export function NoteEditor({ note, onSave, onRequestDelete }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({})
  const [saving, setSaving] = useState(false)

  const dirty = title !== (note?.title ?? '') || body !== (note?.body ?? '')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = title.trim()
    const next: typeof errors = {}
    if (!trimmed) next.title = 'Give your note a title'
    else if (trimmed.length > NOTE_TITLE_MAX) next.title = `Keep the title under ${NOTE_TITLE_MAX} characters`
    if (body.length > NOTE_BODY_MAX) next.body = 'This note is too long'
    setErrors(next)
    if (next.title || next.body) return
    setSaving(true)
    await onSave({ title: trimmed, body })
    setSaving(false)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
      <TextField
        label="Title"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
      />
      <Field data-invalid={errors.body ? true : undefined} className="flex-1">
        <FieldLabel htmlFor="note-body">Note</FieldLabel>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={errors.body ? true : undefined}
          className="min-h-[45dvh] flex-1 resize-y text-base"
        />
        {errors.body && <FieldError>{errors.body}</FieldError>}
      </Field>
      <div className="flex justify-between gap-3">
        {onRequestDelete ? (
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
          {note ? 'Save' : 'Create note'}
        </Button>
      </div>
    </form>
  )
}
