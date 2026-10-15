import { type ReactNode, useCallback, useEffect, useRef } from 'react'

import { notify } from '@/components/feedback/toast'
import { ROUTES } from '@/lib/routes'
import { CLIENT_ID } from '@/lib/events/client-id'
import { LiveEventsContext } from '@/lib/events/context'
import type { LiveEvent, LiveEventListener } from '@/lib/events/types'

/** Shown when a change came from another tab or device. One toast per module, not per event. */
const ELSEWHERE: Record<string, string> = {
  todo: 'Your to-dos were updated elsewhere.',
  note: 'Your notes were updated elsewhere.',
  shopping: 'Your shopping list was updated elsewhere.',
  budget: 'Your budgets were updated elsewhere.',
  expense: 'Your spending was updated elsewhere.',
  calendar: 'Your calendar was updated elsewhere.',
  vault: 'Your vault was updated elsewhere.',
  // notification.* has no entry: the bell shows those itself.
}

/**
 * Opens one Server-Sent Events stream for the signed-in session and hands each event to the
 * subscribed hooks. EventSource reconnects by itself after a drop; on reconnect we ask every
 * listener to refetch, because events sent while disconnected are lost.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<LiveEventListener>())

  const subscribe = useCallback((listener: LiveEventListener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    const emit = (event: LiveEvent) => listeners.current.forEach((l) => l(event))
    const source = new EventSource(ROUTES.api.events, { withCredentials: true })
    let opened = false

    source.onopen = () => {
      if (opened) emit({ type: 'resync' })
      opened = true
    }
    source.onmessage = (msg: MessageEvent<string>) => {
      let event: LiveEvent
      try {
        event = JSON.parse(msg.data) as LiveEvent
      } catch {
        return
      }
      emit(event)
      const module = event.type.split('.')[0]
      const text = ELSEWHERE[module]
      if (text && event.origin !== CLIENT_ID) notify.info(text, `elsewhere-${module}`)
    }
    return () => source.close()
  }, [])

  return <LiveEventsContext value={subscribe}>{children}</LiveEventsContext>
}
