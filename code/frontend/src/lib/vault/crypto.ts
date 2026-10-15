/**
 * Vault cryptography. Everything here runs in the browser; the server only ever receives
 * the outputs (docs/Vault-Threat-Model.md). Kept free of React and app imports so it can move
 * into a shared package when the browser extension starts.
 *
 * Keys: master password --Argon2id--> KEK; random vault key wrapped by the KEK and, separately,
 * by a random recovery key. Items: XChaCha20-Poly1305 under the vault key, AAD bound to the
 * user and the item id.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { argon2idAsync } from '@noble/hashes/argon2.js'

export interface KdfParams {
  memoryKib: number
  iterations: number
  parallelism: number
}

/** Bitwarden-level cost: 64 MiB, 3 passes. Stored per user so it can be raised later. */
export const KDF: KdfParams = { memoryKib: 64 * 1024, iterations: 3, parallelism: 1 }

/** What the server stores: all base64, none of it readable without a key. */
export interface VaultKeyRecord {
  kdf: 'argon2id'
  kdfParams: KdfParams
  salt: string
  wrappedKey: string
  wrapNonce: string
  recoveryWrappedKey: string
  recoveryNonce: string
}

/** One login, as it exists only in memory after decryption. */
export interface VaultEntry {
  title: string
  url: string
  username: string
  password: string
  notes: string
}

/** Wrong master password or recovery key (the AEAD tag did not verify). */
export class WrongSecretError extends Error {
  constructor() {
    super('That password or key is not right.')
    this.name = 'WrongSecretError'
  }
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** Overwrite key material when done (best effort: JS cannot guarantee no copies). */
export function wipe(bytes: Uint8Array | null | undefined): void {
  bytes?.fill(0)
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/* ─── Recovery code: 32 bytes as Crockford base32, groups of four ─── */

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function formatRecoveryCode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join('-')
}

/** Accepts any spacing, dashes or case; reads I/L as 1 and O as 0. Null if not a 32-byte code. */
export function parseRecoveryCode(code: string): Uint8Array | null {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const v = B32.indexOf(ch)
    if (v < 0) return null
    value = ((value << 5) | v) & 0xffff
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return out.length === 32 ? new Uint8Array(out) : null
}

/* ─── Primitives ─── */

export async function deriveKek(password: string, salt: Uint8Array, p: KdfParams): Promise<Uint8Array> {
  return argon2idAsync(enc.encode(password.normalize('NFKC')), salt, {
    m: p.memoryKib,
    t: p.iterations,
    p: p.parallelism,
    dkLen: 32,
    maxmem: p.memoryKib * 1024 + 1024 * 1024,
  })
}

function seal(key: Uint8Array, plaintext: Uint8Array, aad: string) {
  const nonce = randomBytes(24)
  const ciphertext = xchacha20poly1305(key, nonce, enc.encode(aad)).encrypt(plaintext)
  return { ciphertext, nonce }
}

function open(key: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array, aad: string): Uint8Array {
  try {
    return xchacha20poly1305(key, nonce, enc.encode(aad)).decrypt(ciphertext)
  } catch {
    throw new WrongSecretError()
  }
}

const wrapAad = (userId: string) => `vault-key:${userId}`
const recoveryAad = (userId: string) => `vault-recovery:${userId}`
const itemAad = (userId: string, itemId: string) => `vault:${userId}:${itemId}`

/* ─── Flows ─── */

/** First-time set-up: a new vault key, wrapped twice. The recovery code is shown to the user once. */
export async function setupVault(userId: string, master: string, params: KdfParams = KDF) {
  const salt = randomBytes(16)
  const vaultKey = randomBytes(32)
  const recoveryKey = randomBytes(32)
  const kek = await deriveKek(master, salt, params)
  const wrapped = seal(kek, vaultKey, wrapAad(userId))
  const recovered = seal(recoveryKey, vaultKey, recoveryAad(userId))
  const record: VaultKeyRecord = {
    kdf: 'argon2id',
    kdfParams: params,
    salt: toBase64(salt),
    wrappedKey: toBase64(wrapped.ciphertext),
    wrapNonce: toBase64(wrapped.nonce),
    recoveryWrappedKey: toBase64(recovered.ciphertext),
    recoveryNonce: toBase64(recovered.nonce),
  }
  const recoveryCode = formatRecoveryCode(recoveryKey)
  wipe(kek)
  wipe(recoveryKey)
  return { record, vaultKey, recoveryCode }
}

/** Unlock with the master password. Throws WrongSecretError on a wrong password. */
export async function unlockVault(userId: string, master: string, record: VaultKeyRecord): Promise<Uint8Array> {
  const kek = await deriveKek(master, fromBase64(record.salt), record.kdfParams)
  try {
    return open(kek, fromBase64(record.wrappedKey), fromBase64(record.wrapNonce), wrapAad(userId))
  } finally {
    wipe(kek)
  }
}

/** A new master-password wrap of the same vault key (items untouched, recovery code unchanged). */
export async function rewrapWithMaster(
  userId: string,
  vaultKey: Uint8Array,
  newMaster: string,
  record: VaultKeyRecord,
  params: KdfParams = KDF,
): Promise<VaultKeyRecord> {
  const salt = randomBytes(16)
  const kek = await deriveKek(newMaster, salt, params)
  const wrapped = seal(kek, vaultKey, wrapAad(userId))
  wipe(kek)
  return {
    ...record,
    kdfParams: params,
    salt: toBase64(salt),
    wrappedKey: toBase64(wrapped.ciphertext),
    wrapNonce: toBase64(wrapped.nonce),
  }
}

/** Forgot the master password: open the vault key with the recovery code, then set a new password. */
export async function recoverVault(
  userId: string,
  recoveryCode: string,
  newMaster: string,
  record: VaultKeyRecord,
  params: KdfParams = KDF,
) {
  const recoveryKey = parseRecoveryCode(recoveryCode)
  if (!recoveryKey) throw new WrongSecretError()
  try {
    const vaultKey = open(
      recoveryKey,
      fromBase64(record.recoveryWrappedKey),
      fromBase64(record.recoveryNonce),
      recoveryAad(userId),
    )
    return { vaultKey, record: await rewrapWithMaster(userId, vaultKey, newMaster, record, params) }
  } finally {
    wipe(recoveryKey)
  }
}

export function encryptEntry(vaultKey: Uint8Array, userId: string, itemId: string, entry: VaultEntry) {
  const sealed = seal(vaultKey, enc.encode(JSON.stringify(entry)), itemAad(userId, itemId))
  return { ciphertext: toBase64(sealed.ciphertext), nonce: toBase64(sealed.nonce) }
}

export function decryptEntry(
  vaultKey: Uint8Array,
  userId: string,
  itemId: string,
  ciphertext: string,
  nonce: string,
): VaultEntry {
  const plain = open(vaultKey, fromBase64(ciphertext), fromBase64(nonce), itemAad(userId, itemId))
  return JSON.parse(dec.decode(plain)) as VaultEntry
}

/** Strong random password: 20 characters from letters, digits and symbols. */
export function generatePassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?'
  const out: string[] = []
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % chars.length)
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out.push(chars[b % chars.length])
    }
  }
  return out.join('')
}
