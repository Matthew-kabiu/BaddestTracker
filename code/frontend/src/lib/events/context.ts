import { createContext, useContext, useEffect } from 'react'

import type { LiveEventListener } from '@/lib/events/types'

/** Register a listener; returns the unsubscribe function. */
export type Subscribe = (listener: LiveEventListener) => () => void

export const LiveEventsContext = createContext<Subscribe | null>(null)

/**
 * Run `listener` for every live event while the component is mounted. Pass a stable function
 * (useCallback). Outside the provider (e.g. tests, public pages) it does nothing.
 */
export function useLiveEvents(listener: LiveEventListener) {
  const subscribe = useContext(LiveEventsContext)
  useEffect(() => subscribe?.(listener), [subscribe, listener])
}
