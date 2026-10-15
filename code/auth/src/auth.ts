import { betterAuth } from 'better-auth'
import pg from 'pg'
import { env } from './env.js'

// Better Auth takes any Standard Schema; this one is small enough to write by hand (no zod here).
const currencyCode = {
  '~standard': {
    version: 1,
    vendor: 'baddest-tracker',
    validate: (value: unknown) =>
      value === null || (typeof value === 'string' && /^[A-Z]{3}$/.test(value))
        ? { value }
        : { issues: [{ message: 'currency must be a three-letter ISO 4217 code' }] },
  },
} as const

// Better Auth owns the user / session / account / verification tables in the shared Postgres.
// The Rust backend never touches them; it asks GET /api/auth/get-session who is calling.
export const auth = betterAuth({
  secret: env.secret,
  baseURL: env.baseURL,
  database: new pg.Pool({ connectionString: env.databaseURL }),
  trustedOrigins: env.corsOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // No email sending exists yet, so addresses are never verified and change straight away.
    // Once verification emails exist, verified users will confirm the new address instead.
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    additionalFields: {
      // ISO 4217 code for money formatting. Null = plain numbers, no symbol.
      currency: { type: 'string', required: false, input: true, validator: { input: currencyCode } },
    },
  },
  // In-memory, per client IP. Better Auth's defaults: 100 requests / 10 s overall, and 3 / 10 s on
  // sign-in, sign-up and password changes. Enabled in every environment so dev behaves like prod.
  rateLimit: {
    enabled: true,
    // The Rust backend calls get-session once per API request, all from one container address,
    // so limiting it here would throttle every user as one. The backend limits those per client.
    customRules: { '/get-session': false },
  },
  advanced: {
    useSecureCookies: env.isProduction,
    // Behind the Cloudflare Tunnel the real client is in CF-Connecting-IP (Cloudflare overwrites
    // any client-sent value). Other forwarding headers are spoofable, so they are not trusted.
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    ...(env.cookieDomain && {
      crossSubDomainCookies: { enabled: true, domain: env.cookieDomain },
    }),
  },
})
