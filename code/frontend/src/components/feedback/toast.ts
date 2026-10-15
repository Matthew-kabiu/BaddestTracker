import { toast } from 'sonner'

import { ApiClientError } from '@/lib/api/apiClient'

const FALLBACK = 'Something went wrong. Please try again.'

/** The only toast entry point. Errors show mapped, friendly copy — never raw server text. */
export const notify = {
  success: (msg: string) => toast.success(msg),
  /** Pass an `id` to replace an earlier toast with the same id instead of stacking. */
  info: (msg: string, id?: string) => toast.info(msg, { id }),
  warning: (msg: string) => toast.warning(msg),
  /** A titled message with detail underneath (used for notifications). */
  message: (title: string, description: string) => toast.info(title, { description }),
  error: (err: unknown, fallback: string = FALLBACK) => {
    const msg = err instanceof ApiClientError ? err.userMessage : fallback
    toast.error(msg)
  },
  promise: toast.promise,
}
