/** Required environment for the auth service. No defaults: a missing value stops the boot. */
function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set (see .env.example)`)
  return value
}

const port = Number(required('AUTH_PORT'))
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('AUTH_PORT must be a valid port')

const secret = required('BETTER_AUTH_SECRET')
if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')

const corsOrigins = required('CORS_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean)
if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGINS must list explicit origins, never *')
}

const appEnv = required('APP_ENV')
const baseURL = required('BETTER_AUTH_URL')

// Parent domain shared by the web, API and auth hosts (e.g. example.com for app./api./auth.),
// so the session cookie reaches the API. Local dev is all localhost, where a host-only cookie
// already works, so it is required everywhere except development.
const cookieDomain = appEnv === 'development' ? undefined : required('AUTH_COOKIE_DOMAIN')
if (cookieDomain) {
  const host = new URL(baseURL).hostname
  if (host !== cookieDomain && !host.endsWith(`.${cookieDomain}`)) {
    throw new Error(`AUTH_COOKIE_DOMAIN (${cookieDomain}) must be a parent of the BETTER_AUTH_URL host (${host})`)
  }
}

export const env = {
  port,
  secret,
  baseURL,
  databaseURL: required('DATABASE_URL'),
  corsOrigins,
  cookieDomain,
  isProduction: appEnv === 'production',
}
