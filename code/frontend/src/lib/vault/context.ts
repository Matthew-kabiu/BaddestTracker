import { createContext, useContext } from 'react'

import type { VaultEntry } from '@/lib/vault/crypto'

export type VaultStatus = 'loading' | 'absent' | 'locked' | 'unlocked' | 'error'

export interface DecryptedItem {
  id: string
  entry: VaultEntry
  updatedAt: string
}

export interface VaultContextValue {
  status: VaultStatus
  items: DecryptedItem[]
  /** Returns the recovery code to show once. */
  setup: (master: string) => Promise<string>
  unlock: (master: string) => Promise<void>
  recover: (recoveryCode: string, newMaster: string) => Promise<void>
  changeMaster: (newMaster: string) => Promise<void>
  lock: () => void
  save: (entry: VaultEntry, id?: string) => Promise<void>
  remove: (id: string) => Promise<void>
  wipeAll: () => Promise<void>
}

export const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}
