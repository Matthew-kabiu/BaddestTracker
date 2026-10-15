import { useCallback, useEffect, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type { Todo, UpdateTodoDTO } from '@/types/api'

export type LoadStatus = 'loading' | 'error' | 'ready'

/** Server state for the to-do list. Every mutation reports failure with a friendly toast. */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')

  const [reloadKey, setReloadKey] = useState(0)

  // Fetch on mount and on every reload. State is set in promise callbacks (never synchronously
  // in the effect), and a stale response is ignored after unmount or a newer reload.
  useEffect(() => {
    let cancelled = false
    apiClient.todos
      .list()
      .then((data) => {
        if (cancelled) return
        setTodos(data)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        notify.error(err, "We couldn't load your to-dos.")
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // A to-do changed somewhere (another device, or this tab too, which is harmless): refetch
  // quietly, with no loading state, so the list stays on screen.
  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'resync' || event.type.startsWith('todo.')) setReloadKey((k) => k + 1)
    }, []),
  )

  /** User-triggered retry (e.g. "Try again" after an error). */
  const load = useCallback(() => {
    setStatus('loading')
    setReloadKey((k) => k + 1)
  }, [])

  const create = useCallback(async (title: string) => {
    try {
      const todo = await apiClient.todos.create({ title })
      setTodos((prev) => [todo, ...prev])
      return true
    } catch (err) {
      notify.error(err, "We couldn't add that to-do.")
      return false
    }
  }, [])

  const update = useCallback(async (id: string, dto: UpdateTodoDTO) => {
    try {
      const updated = await apiClient.todos.update(id, dto)
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return true
    } catch (err) {
      notify.error(err, "We couldn't save that change.")
      return false
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await apiClient.todos.remove(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
      notify.success('To-do deleted.')
      return true
    } catch (err) {
      notify.error(err, "We couldn't delete that to-do.")
      return false
    }
  }, [])

  return { todos, status, reload: load, create, update, remove }
}
