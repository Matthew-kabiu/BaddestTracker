/** Backend error code → friendly copy. Raw backend messages never reach the user. */
const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Some of the details you entered need another look.',
  UNAUTHORIZED: 'Your session has ended. Please sign in again.',
  FORBIDDEN: "You don't have access to that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: 'That already exists.',
  RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  NETWORK_ERROR: "We can't reach the server. Check your connection and try again.",
  TIMEOUT: 'That took too long. Please try again.',
}

const FALLBACK = 'Something went wrong. Please try again.'

export function mapErrorToMessage(code: string, status: number): string {
  if (MESSAGES[code]) return MESSAGES[code]
  if (status === 401) return MESSAGES.UNAUTHORIZED
  if (status === 403) return MESSAGES.FORBIDDEN
  if (status === 404) return MESSAGES.NOT_FOUND
  if (status === 429) return MESSAGES.RATE_LIMIT_EXCEEDED
  if (status >= 500) return MESSAGES.INTERNAL_ERROR
  return FALLBACK
}
