import { FileText, NotebookPen, Plus, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/kit/card'
import { Page } from '@/components/layout/Page'
import { useNotes } from '@/hooks/use-notes'
import type { CreateNoteDTO } from '@/types/api'

/** "new" = composing; a note id = editing; null = nothing selected. */
type Selection = 'new' | string | null

export default function NotesPage() {
  const { notes, status, reload, create, update, remove } = useNotes()
  const [selection, setSelection] = useState<Selection>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const closeDialog = useCallback(() => setConfirmOpen(false), [])

  const selected = selection && selection !== 'new' ? (notes.find((n) => n.id === selection) ?? null) : null

  async function handleSave(dto: CreateNoteDTO) {
    if (selected) {
      // Send only the fields that changed — the API rejects unknown keys and we keep payloads minimal.
      const patch: Partial<CreateNoteDTO> = {}
      if (dto.title !== selected.title) patch.title = dto.title
      if (dto.body !== selected.body) patch.body = dto.body
      await update(selected.id, patch)
    } else {
      const note = await create(dto)
      if (note) setSelection(note.id)
    }
  }

  if (status === 'loading') return <LoadingState label="Loading your notes…" />

  if (status === 'error') {
    return (
      <EmptyState
        icon={NotebookPen}
        title="We couldn't load your notes"
        description="Check your connection and try again."
        action={
          <Button variant="outline" onClick={reload}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <Page
      title="Notes"
      description="A home for the thoughts you want to keep."
      actions={
        <Button onClick={() => setSelection('new')}>
          <Plus aria-hidden="true" />
          New note
        </Button>
      }
    >
    <section className="grid w-full min-w-0 grid-cols-1 gap-5 md:grid-cols-[2fr_3fr] xl:grid-cols-[1fr_2fr]">
      <Card className="min-w-0 gap-0 overflow-hidden self-start py-0">
        <CardHeader className="border-b bg-muted/30 p-5 [.border-b]:pb-5"><CardTitle className="flex items-center justify-between text-sm">Your notebook<span className="rounded-full bg-muted px-2.5 py-1 text-xs text-fg-muted tabular-nums">{notes.length}</span></CardTitle></CardHeader>
        <CardContent className="flex max-h-[60dvh] flex-col overflow-y-auto p-0">
        {notes.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-fg-muted">No notes yet.</p>
        ) : (
          <ul className="divide-y divide-line" aria-label="Notes">
            {notes.map((note) => (
              <li key={note.id}>
                <Button
                  variant="ghost"
                  onClick={() => setSelection(note.id)}
                  aria-current={note.id === selection ? 'true' : undefined}
                  className={`h-auto w-full flex-col items-start gap-2 rounded-none! border-l-2 p-5 text-left whitespace-normal ${
                    note.id === selection ? 'border-primary bg-primary-soft hover:bg-primary-soft' : 'border-transparent'
                  }`}
                >
                  <span className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-fg"><FileText aria-hidden="true" className="size-[1.1em] shrink-0 text-primary-ink" /><span className="truncate">{note.title}</span></span>
                  {note.body && <span className="line-clamp-2 text-xs leading-relaxed font-normal text-fg-muted">{note.body}</span>}
                  <span className="text-xs font-normal text-fg-subtle">
                    {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        </CardContent>
      </Card>

      <Card className="min-h-[55dvh] min-w-0">
        <CardContent className={selection === null ? 'flex flex-1 items-center justify-center' : ''}>
        {selection === null ? (
          <EmptyState
            icon={NotebookPen}
            title={notes.length === 0 ? 'Give your ideas a little space.' : 'Something worth coming back to.'}
            description={
              notes.length === 0 ? 'Notes you create appear here.' : 'Choose a note on the left, or start a new one.'
            }
            action={<Button variant="outline" onClick={() => setSelection('new')}><Plus aria-hidden="true" />New note</Button>}
          />
        ) : (
          <NoteEditor
            key={selection}
            note={selected}
            onSave={handleSave}
            onRequestDelete={selected ? () => setConfirmOpen(true) : undefined}
          />
        )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen && selected !== null}
        title="Delete this note?"
        description={selected ? `"${selected.title}" will be removed permanently.` : ''}
        onCancel={closeDialog}
        onConfirm={async () => {
          if (selected && (await remove(selected.id))) {
            closeDialog()
            setSelection(null)
          }
        }}
      />
    </section>
    </Page>
  )
}
