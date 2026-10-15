/** Master password rule (docs/Vault-Threat-Model.md §4): at least 12 characters. */
export const MASTER_MIN = 12

export function masterProblem(master: string, confirm: string): string | undefined {
  if (master.length < MASTER_MIN) return `Use at least ${MASTER_MIN} characters. A short sentence works well.`
  if (master !== confirm) return 'The two passwords do not match'
  return undefined
}
