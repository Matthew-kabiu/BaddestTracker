/** Better Auth error → friendly copy. Its raw messages are never shown to the user. */
interface AuthErrorLike {
  status?: number
  code?: string
}

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Email or password is incorrect.',
  USER_ALREADY_EXISTS: 'An account with that email already exists. Try signing in.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with that email already exists. Try signing in.',
  PASSWORD_TOO_SHORT: 'That password is too short.',
  PASSWORD_TOO_LONG: 'That password is too long.',
  INVALID_EMAIL: 'Please enter a valid email address.',
}

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (error?.code && BY_CODE[error.code]) return BY_CODE[error.code]
  if (error?.status === 401) return BY_CODE.INVALID_EMAIL_OR_PASSWORD
  if (error?.status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (error?.status === 0 || error?.status === undefined) {
    return "We can't reach the sign-in service. Check your connection and try again."
  }
  return 'Something went wrong. Please try again.'
}
