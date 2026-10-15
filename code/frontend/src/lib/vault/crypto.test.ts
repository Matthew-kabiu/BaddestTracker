import { describe, expect, it } from 'vitest'

import {
  KDF,
  WrongSecretError,
  decryptEntry,
  encryptEntry,
  formatRecoveryCode,
  generatePassword,
  parseRecoveryCode,
  randomBytes,
  recoverVault,
  rewrapWithMaster,
  setupVault,
  unlockVault,
} from './crypto'

// Cheap Argon2id for speed; one test below uses the real KDF cost.
const FAST = { memoryKib: 1024, iterations: 1, parallelism: 1 }
const USER = 'user-1'
const ENTRY = { title: 'Bank', url: 'https://bank.example', username: 'matt', password: 'hunter2-XYZ', notes: 'pin 0000' }

describe('vault crypto', () => {
  it('unlocks with the right master password and refuses a wrong one', async () => {
    const { record, vaultKey } = await setupVault(USER, 'correct horse battery', FAST)
    expect(await unlockVault(USER, 'correct horse battery', record)).toEqual(vaultKey)
    await expect(unlockVault(USER, 'wrong password', record)).rejects.toBeInstanceOf(WrongSecretError)
  })

  it('round-trips an entry and stores no plaintext', async () => {
    const { vaultKey } = await setupVault(USER, 'pw-123456789', FAST)
    const sealed = encryptEntry(vaultKey, USER, 'item-1', ENTRY)
    const blob = atob(sealed.ciphertext)
    for (const v of Object.values(ENTRY)) expect(blob.includes(v)).toBe(false)
    expect(decryptEntry(vaultKey, USER, 'item-1', sealed.ciphertext, sealed.nonce)).toEqual(ENTRY)
  })

  it('rejects a blob moved to another item or user, or tampered', async () => {
    const { vaultKey } = await setupVault(USER, 'pw-123456789', FAST)
    const sealed = encryptEntry(vaultKey, USER, 'item-1', ENTRY)
    expect(() => decryptEntry(vaultKey, USER, 'item-2', sealed.ciphertext, sealed.nonce)).toThrow(WrongSecretError)
    expect(() => decryptEntry(vaultKey, 'user-2', 'item-1', sealed.ciphertext, sealed.nonce)).toThrow(WrongSecretError)
    const bytes = Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0))
    bytes[0] ^= 1
    const tampered = btoa(String.fromCharCode(...bytes))
    expect(() => decryptEntry(vaultKey, USER, 'item-1', tampered, sealed.nonce)).toThrow(WrongSecretError)
  })

  it('recovers with the recovery code and keeps items readable', async () => {
    const { record, vaultKey, recoveryCode } = await setupVault(USER, 'forgotten', FAST)
    const sealed = encryptEntry(vaultKey, USER, 'item-1', ENTRY)
    const recovered = await recoverVault(USER, recoveryCode.toLowerCase().replace(/-/g, ' '), 'new master pw', record, FAST)
    expect(recovered.vaultKey).toEqual(vaultKey)
    // The new master password now unlocks, the old one does not, and the item still decrypts.
    const key = await unlockVault(USER, 'new master pw', recovered.record)
    await expect(unlockVault(USER, 'forgotten', recovered.record)).rejects.toBeInstanceOf(WrongSecretError)
    expect(decryptEntry(key, USER, 'item-1', sealed.ciphertext, sealed.nonce)).toEqual(ENTRY)
    await expect(recoverVault(USER, 'not-a-code', 'x', record, FAST)).rejects.toBeInstanceOf(WrongSecretError)
  })

  it('changes the master password without touching items', async () => {
    const { record, vaultKey } = await setupVault(USER, 'old-password', FAST)
    const next = await rewrapWithMaster(USER, vaultKey, 'new-password', record, FAST)
    expect(next.recoveryWrappedKey).toBe(record.recoveryWrappedKey)
    expect(await unlockVault(USER, 'new-password', next)).toEqual(vaultKey)
  })

  it('formats and parses recovery codes, forgiving O/0 and I/L/1', () => {
    const raw = randomBytes(32)
    const code = formatRecoveryCode(raw)
    expect(code).toMatch(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/)
    expect(parseRecoveryCode(code)).toEqual(raw)
    expect(parseRecoveryCode(code.replace(/0/g, 'O').replace(/1/g, 'l'))).toEqual(raw)
    expect(parseRecoveryCode('ABCD')).toBeNull()
  })

  it('generates strong passwords', () => {
    const a = generatePassword()
    expect(a).toHaveLength(20)
    expect(generatePassword()).not.toBe(a)
  })

  it('works at the real KDF cost', async () => {
    const started = performance.now()
    const { record, vaultKey } = await setupVault(USER, 'real cost', KDF)
    expect(await unlockVault(USER, 'real cost', record)).toEqual(vaultKey)
    console.info(`real-cost setup + unlock: ${Math.round(performance.now() - started)} ms`)
  }, 60_000)
})
