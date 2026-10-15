import { z } from 'zod'

/** Public build-time config. Every value is required — missing or invalid stops the app at load. */
const envSchema = z.object({
  VITE_API_BASE_URL: z.url(),
  VITE_AUTH_BASE_URL: z.url(),
  VITE_APP_NAME: z.string().min(1),
  VITE_ENVIRONMENT: z.enum(['development', 'staging', 'production']),
})

const parsed = envSchema.safeParse(import.meta.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error))
  throw new Error('Invalid environment configuration — see .env.example')
}

export const env = parsed.data
