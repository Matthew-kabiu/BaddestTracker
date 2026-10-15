import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api/apiClient'
import { useSession } from '@/lib/auth/client'
import { useLiveEvents } from '@/lib/events/context'
import type { LiveEvent } from '@/lib/events/types'
import { VaultContext, type DecryptedItem, type VaultStatus } from '@/lib/vault/context'
import {
  type VaultEntry,
  type VaultKeyRecord,
  decryptEntry,
  encryptEntry,
  recoverVault,
  rewrapWithMaster,
  setupVault,
  unlockVault,
  wipe,
} from '@/lib/vault/crypto'

/** Lock after this long without a click or key press. */
const IDLE_LOCK_MS = 15 * 60 * 1000

/**
 * Holds the vault for the dashboard session. The vault key lives only in memory (a ref, never
 * storage) and is wiped on lock, idle timeout, or leaving the dashboard.
 */
export function VaultProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const userId = session?.user.id
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [items, setItems] = useState<DecryptedItem[]>([])
  const record = useRef<VaultKeyRecord | null>(null)
  const vaultKey = useRef<Uint8Array | null>(null)
  const lastActive = useRef(0)

  const lock = useCallback(() => {
    wipe(vaultKey.current)
    vaultKey.current = null
    setItems([])
    setStatus(record.current ? 'locked' : 'absent')
  }, [])

  const loadItems = useCallback(async () => {
    const key = vaultKey.current
    if (!key || !userId) return
    const blobs = await apiClient.vault.items()
    setItems(
      blobs.map((b) => ({ id: b.id, entry: decryptEntry(key, userId, b.id, b.ciphertext, b.nonce), updatedAt: b.updatedAt })),
    )
  }, [userId])

  const loadKey = useCallback(async () => {
    try {
      record.current = await apiClient.vault.getKey()
      if (!vaultKey.current) setStatus(record.current ? 'locked' : 'absent')
    } catch {
      setStatus('error')
    }
  }, [])

  // First load. State is set in promise callbacks, and ignored after unmount.
  useEffect(() => {
    let cancelled = false
    apiClient.vault.getKey().then(
      (r) => {
        if (cancelled) return
        record.current = r
        setStatus(r ? 'locked' : 'absent')
      },
      () => !cancelled && setStatus('error'),
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Idle lock, and lock when the dashboard (and so this provider) goes away.
  useEffect(() => {
    lastActive.current = Date.now()
    const touch = () => {
      lastActive.current = Date.now()
    }
    const timer = setInterval(() => {
      if (vaultKey.current && Date.now() - lastActive.current > IDLE_LOCK_MS) lock()
    }, 30_000)
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      wipe(vaultKey.current)
      vaultKey.current = null
    }
  }, [lock])

  // Another device changed the vault: reload blobs (or the key, if it was reset).
  useLiveEvents(
    useCallback(
      (event: LiveEvent) => {
        if (event.type === 'vault.deleted' && event.id === '00000000-0000-0000-0000-000000000000') {
          lock()
          void loadKey()
        } else if (event.type === 'resync' || event.type.startsWith('vault.')) {
          void loadItems().catch(() => undefined)
        }
      },
      [loadItems, loadKey, lock],
    ),
  )

  const value = useMemo(() => {
    const need = () => {
      if (!userId) throw new Error('Not signed in')
      return userId
    }
    const open = async (key: Uint8Array, next: VaultKeyRecord) => {
      record.current = next
      vaultKey.current = key
      lastActive.current = Date.now()
      await loadItems()
      setStatus('unlocked')
    }
    return {
      status,
      items,
      lock,
      setup: async (master: string) => {
        const { record: next, vaultKey: key, recoveryCode } = await setupVault(need(), master)
        await apiClient.vault.putKey(next)
        await open(key, next)
        return recoveryCode
      },
      unlock: async (master: string) => {
        const current = record.current ?? (await apiClient.vault.getKey())
        if (!current) throw new Error('The vault is not set up')
        await open(await unlockVault(need(), master, current), current)
      },
      recover: async (code: string, newMaster: string) => {
        const current = record.current ?? (await apiClient.vault.getKey())
        if (!current) throw new Error('The vault is not set up')
        const { vaultKey: key, record: next } = await recoverVault(need(), code, newMaster, current)
        await apiClient.vault.putKey(next)
        await open(key, next)
      },
      changeMaster: async (newMaster: string) => {
        if (!vaultKey.current || !record.current) throw new Error('Unlock the vault first')
        const next = await rewrapWithMaster(need(), vaultKey.current, newMaster, record.current)
        await apiClient.vault.putKey(next)
        record.current = next
      },
      save: async (entry: VaultEntry, id?: string) => {
        if (!vaultKey.current) throw new Error('Unlock the vault first')
        const itemId = id ?? crypto.randomUUID()
        const blob = encryptEntry(vaultKey.current, need(), itemId, entry)
        if (id) await apiClient.vault.update(id, blob)
        else await apiClient.vault.create({ id: itemId, ...blob })
        await loadItems()
      },
      remove: async (id: string) => {
        await apiClient.vault.remove(id)
        setItems((prev) => prev.filter((i) => i.id !== id))
      },
      wipeAll: async () => {
        await apiClient.vault.wipe()
        record.current = null
        lock()
      },
    }
  }, [status, items, lock, loadItems, userId])

  return <VaultContext value={value}>{children}</VaultContext>
}
