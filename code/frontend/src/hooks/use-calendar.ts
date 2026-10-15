import { useCallback, useEffect, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import type { LoadStatus } from '@/hooks/use-todos'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type { CreateEventDTO, Occurrence, UpdateEventDTO } from '@/types/api'

/** Occurrences overlapping `from..to` (YYYY-MM-DD), plus series writes. Refetches after each write. */
export function useCalendar(from: string, to: string) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiClient.calendar
      .list(from, to)
      .then((data) => {
        if (cancelled) return
        setOccurrences(data)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        notify.error(err, "We couldn't load your calendar.")
      })
    return () => {
      cancelled = true
    }
  }, [from, to, reloadKey])

  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'resync' || event.type.startsWith('calendar.')) setReloadKey((k) => k + 1)
    }, []),
  )

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])
  const reload = useCallback(() => {
    setStatus('loading')
    refresh()
  }, [refresh])

  const run = useCallback(
    async (work: () => Promise<unknown>, failure: string, success: string) => {
      try {
        await work()
        refresh()
        notify.success(success)
        return true
      } catch (err) {
        notify.error(err, failure)
        return false
      }
    },
    [refresh],
  )

  return {
    occurrences,
    status,
    reload,
    create: (dto: CreateEventDTO) => run(() => apiClient.calendar.create(dto), "We couldn't save that event.", 'Event added.'),
    update: (id: string, dto: UpdateEventDTO) =>
      run(() => apiClient.calendar.update(id, dto), "We couldn't save that event.", 'Event updated.'),
    remove: (id: string) => run(() => apiClient.calendar.remove(id), "We couldn't delete that event.", 'Event deleted.'),
  }
}
