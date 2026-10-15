import { useCallback, useEffect, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import type { LoadStatus } from '@/hooks/use-todos'
import { apiClient } from '@/lib/api/apiClient'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import type { CreateShoppingItemDTO, ShoppingItem, UpdateShoppingItemDTO } from '@/types/api'

/** Server state for the shopping list. Mutations report failure with a friendly toast. */
export function useShopping() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiClient.shopping
      .list()
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        notify.error(err, "We couldn't load your shopping list.")
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // A shopping change anywhere: refetch quietly so the list stays on screen.
  useLiveEvents(
    useCallback((event: LiveEvent) => {
      if (event.type === 'resync' || event.type.startsWith('shopping.')) setReloadKey((k) => k + 1)
    }, []),
  )

  const reload = useCallback(() => {
    setStatus('loading')
    setReloadKey((k) => k + 1)
  }, [])

  const create = useCallback(async (dto: CreateShoppingItemDTO) => {
    try {
      const item = await apiClient.shopping.create(dto)
      setItems((prev) => [item, ...prev])
      return true
    } catch (err) {
      notify.error(err, "We couldn't add that item.")
      return false
    }
  }, [])

  const update = useCallback(async (id: string, dto: UpdateShoppingItemDTO) => {
    try {
      const updated = await apiClient.shopping.update(id, dto)
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      return true
    } catch (err) {
      notify.error(err, "We couldn't save that change.")
      return false
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await apiClient.shopping.remove(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      notify.success('Item removed.')
      return true
    } catch (err) {
      notify.error(err, "We couldn't remove that item.")
      return false
    }
  }, [])

  return { items, status, reload, create, update, remove }
}
