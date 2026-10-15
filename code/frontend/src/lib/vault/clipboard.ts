/** How long a copied secret stays on the clipboard. */
export const CLIPBOARD_CLEAR_MS = 30_000

/** Copy, then clear the clipboard after 30 s (only if it still holds what we put there). */
export async function copySecret(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  setTimeout(() => {
    navigator.clipboard
      .readText()
      .then((now) => (now === text ? navigator.clipboard.writeText('') : undefined))
      // Reading may be denied; clear anyway rather than leave a password behind.
      .catch(() => navigator.clipboard.writeText('').catch(() => undefined))
  }, CLIPBOARD_CLEAR_MS)
}
