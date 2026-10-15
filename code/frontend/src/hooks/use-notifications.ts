import { useCallback, useEffect, useRef, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type { AppNotification } from '@/types/api'

/**
 * The bell's inbox. Refetches on any notification event; a brand-new one also pops a toast with
 * its title, so the user sees it even with the panel closed.
 */
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  // Id of a just-created notification to toast once the refetch brings it in.
  const announce = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient.notifications
      .list()
      .then((inbox) => {
        if (cancelled) return
        setItems(inbox.items)
        setUnreadCount(inbox.unreadCount)
        const fresh = inbox.items.find((n) => n.id === announce.current)
        if (fresh) notify.message(fresh.title, fresh.body)
        announce.current = null
      })
      // The bell is secondary UI: a failed refresh keeps the last list instead of toasting.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'notification.created' && event.id) announce.current = event.id
      if (event.type === 'resync' || event.type.startsWith('notification.')) setReloadKey((k) => k + 1)
    }, []),
  )

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)))
      await apiClient.notifications.setRead(id, true).catch(() => undefined)
      refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    try {
      await apiClient.notifications.readAll()
      refresh()
    } catch (err) {
      notify.error(err, "We couldn't mark those as read.")
    }
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      try {
        await apiClient.notifications.remove(id)
        setItems((prev) => prev.filter((n) => n.id !== id))
        refresh()
      } catch (err) {
        notify.error(err, "We couldn't remove that notification.")
      }
    },
    [refresh],
  )

  return { items, unreadCount, markRead, markAllRead, remove }
}
