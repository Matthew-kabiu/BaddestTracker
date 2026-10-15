# Password Vault: Threat Model and Design

Status: **Approved by Matt 2026-10-12** (design gate, Rust template §9.4) · Implemented 2026-10-12
Owner: Matt · Written: 2026-10-12 · TaskLabs #259

Decisions taken (§6): separate master password, recovery key shown once, 15-minute idle lock,
`@noble/hashes` + `@noble/ciphers`. See §8 for what was built and measured.

## 1. Goal

Store website and app logins (and later the browser extension's autofill data) so that
**the server never sees anything readable**: not passwords, not usernames, not even site
names. A full database dump, a server log, or a curious operator reveals nothing but encrypted
blobs, their sizes, and timestamps.

## 2. Keys (all made in the browser)

| Key | Made from | Lives | Server sees |
|---|---|---|---|
| **Master password** | the user | the user's head only | never |
| **KEK** (key-encryption key) | Argon2id(master password, salt) | browser memory while unlocked | never |
| **Vault key** | 32 random bytes, made once | browser memory while unlocked | only *wrapped* (encrypted with the KEK) |
| **Recovery key** (if approved, §6) | 32 random bytes, shown once | the user's printout / password manager | only the vault key wrapped with it |

- Argon2id parameters (target, matching Bitwarden's defaults): **64 MiB memory, 3 iterations,
  parallelism 1**, 16-byte random salt per user. Stored with the wrapped key, so they can be raised
  later and re-derived on next unlock.
- Encryption: **XChaCha20-Poly1305** (same family the server already uses for AI keys), random
  24-byte nonce per item, per write.
- Each item's AAD = `vault:<user_id>:<item_id>`, so a blob copied to another row or another user
  fails to decrypt.

## 3. Data the server stores

```
vault_keys    user_id (PK) · kdf ("argon2id") · kdf_params (json) · salt
              wrapped_vault_key · wrap_nonce · [recovery_wrapped_key · recovery_nonce]
              created_at · updated_at
vault_items   id · user_id · ciphertext · nonce · created_at · updated_at
```

Item plaintext (inside the ciphertext only): `{ title, url, username, password, notes }`.
Search and sorting happen in the browser after decryption.

The API is plain CRUD on opaque blobs (`GET/PUT /api/v1/vault/key`, `GET/POST/PATCH/DELETE
/api/v1/vault/items`), owner-scoped like every other module, under the existing rate limit.

## 4. Flows

- **Set up:** choose master password (min 12 chars, strength meter) → derive KEK → make vault key
  → wrap → upload wrapped key + salt + params. Master password is never sent anywhere.
- **Unlock:** fetch salt + params + wrapped key → derive KEK → unwrap. A wrong password fails the
  unwrap (AEAD tag), so the server never learns whether a guess was right.
- **Lock:** the vault key and decrypted items are dropped from memory: on the lock button,
  after **15 minutes idle** (configurable later), on sign-out, and on tab close. Nothing about the
  vault is ever written to localStorage, sessionStorage or IndexedDB.
- **Change master password:** re-wrap the same vault key with a new KEK. Items are untouched.
- **Copy password:** clipboard is cleared after 30 seconds.

## 5. Threats

| Threat | Result | Mitigation |
|---|---|---|
| Database dump / backup leak | Blobs only | E2E encryption; site names are encrypted too |
| Offline guessing of the master password from a dump | Slow | Argon2id 64 MiB × 3; 12-char minimum + strength meter |
| Server or auth service compromised (passive) | Blobs only | Server never holds the KEK or vault key |
| Server compromised (active: serves malicious JavaScript) | **Can capture the master password at next unlock** | Limit of every web vault. Reduced by strict CSP (`script-src 'self'`, already in place), dependency pinning; the browser extension (shipped code, not served) is the stronger client |
| XSS in the app | Could read an unlocked vault | Strict CSP, React escaping, no `dangerouslySetInnerHTML`, vault UI has no rich text |
| Stolen session cookie | Attacker gets blobs, not contents | Master password separate from the login password (§6) |
| Unlocked laptop left open | Exposure until auto-lock | 15-minute idle lock, lock on tab close |
| Clipboard snooping | Short window | 30 s clipboard clear |
| AI assistant reading secrets | None | Vault is excluded from AI tools (already decided, docs/AI-Provider-Decision.md) |
| Logs | None | Server never logs blobs; no plaintext exists server-side |
| Forgotten master password | **Data is unrecoverable** by design | Recovery key (§6), shown once at setup |

Not covered in v1: sharing items between users, TOTP codes, attachments, breach checks.

## 6. Decisions needed from Matt

1. **Separate master password** from the login password? *Recommended: yes.* With the same
   password, anyone who learns the login (or a compromised auth service) could also unlock the
   vault.
2. **Recovery key** shown once at setup? *Recommended: yes.* Without it, a forgotten master
   password means the vault is gone forever. With it, the user must store it safely.
3. **Auto-lock after 15 minutes** idle? *Recommended: yes* (adjustable in Settings later).
4. **Crypto library:** *Recommended: `@noble/hashes` (Argon2id) + `@noble/ciphers`
   (XChaCha20-Poly1305)*: audited, dependency-free, pure TypeScript, no CSP change. If Argon2id
   at 64 MiB proves too slow in a phone browser (target under about 2 s), switch the KDF to
   `hash-wasm`, which needs `'wasm-unsafe-eval'` added to the CSP. Measured before shipping.
5. **One shared TypeScript crypto package** (`code/vault-crypto`) used by the web app now and the
   browser extension later, so both encrypt identically.

## 7. Verification plan (before calling it done)

- Unit tests: wrap/unwrap round trip, wrong password fails, tampered blob fails, AAD swap fails,
  master-password change keeps items readable.
- A test that dumps the vault tables after creating items and asserts no plaintext substring
  (title, username, password, URL) appears.
- Server logs grepped for blob content after a session: none.
- Timing check of unlock on desktop and a phone-sized browser.

## 8. As built (2026-10-12)

- Crypto: `code/frontend/src/lib/vault/crypto.ts` (no React or app imports, ready to move into a
  shared package when the extension starts; kept in the web app for now so the Docker build
  context is unchanged). State: `lib/vault/VaultProvider.tsx` (key in a ref, wiped on lock, idle
  lock, unmount). UI: `pages/dashboard/VaultPage.tsx`, `components/vault/`.
- Server: `code/backend/src/vault/` stores base64 blobs and checks only their shapes (16-byte salt,
  24-byte nonces, 48-byte wrapped keys, items up to 64 KiB, Argon2id bounds 19 MiB to 1 GiB).
  Item ids are made by the browser (bound into AAD). `DELETE /api/v1/vault` starts over.
- Measured: Argon2id 64 MiB x 3 takes about 2.0 s per unlock in desktop Brave (target met, so
  `hash-wasm` was not needed); about 2.4 s in Node. Phone-browser timing still to be checked.
- Verified: 8 unit tests (`pnpm test`); end-to-end in the browser (set-up, recovery-key gate,
  add, copy, lock, wrong password refused, unlock, recovery with the key); a `pg_dump` of the vault
  tables and the server logs contained none of the six plaintext strings used.
- Accepted risk: a stolen session can overwrite the wrapped key or delete items (denial of
  service, never disclosure), the same as deleting any other data with a stolen session.
