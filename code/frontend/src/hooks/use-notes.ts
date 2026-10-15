import { useCallback, useEffect, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import type { LoadStatus } from '@/hooks/use-todos'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type { CreateNoteDTO, Note, UpdateNoteDTO } from '@/types/api'

/** Server state for notes. Mutations return the saved note (or null on failure). */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')

  const [reloadKey, setReloadKey] = useState(0)

  // Fetch on mount and on every reload. State is set in promise callbacks (never synchronously
  // in the effect), and a stale response is ignored after unmount or a newer reload.
  useEffect(() => {
    let cancelled = false
    apiClient.notes
      .list()
      .then((data) => {
        if (cancelled) return
        setNotes(data)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        notify.error(err, "We couldn't load your notes.")
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // A note changed somewhere (another device, or this tab too, which is harmless): refetch
  // quietly, with no loading state, so the list stays on screen.
  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'resync' || event.type.startsWith('note.')) setReloadKey((k) => k + 1)
    }, []),
  )

  /** User-triggered retry (e.g. "Try again" after an error). */
  const load = useCallback(() => {
    setStatus('loading')
    setReloadKey((k) => k + 1)
  }, [])

  const create = useCallback(async (dto: CreateNoteDTO) => {
    try {
      const note = await apiClient.notes.create(dto)
      setNotes((prev) => [note, ...prev])
      notify.success('Note created.')
      return note
    } catch (err) {
      notify.error(err, "We couldn't create that note.")
      return null
    }
  }, [])

  const update = useCallback(async (id: string, dto: UpdateNoteDTO) => {
    try {
      const updated = await apiClient.notes.update(id, dto)
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
      notify.success('Note saved.')
      return updated
    } catch (err) {
      notify.error(err, "We couldn't save that note.")
      return null
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await apiClient.notes.remove(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      notify.success('Note deleted.')
      return true
    } catch (err) {
      notify.error(err, "We couldn't delete that note.")
      return false
    }
  }, [])

  return { notes, status, reload: load, create, update, remove }
}
