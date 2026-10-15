import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth.js'
import { env } from './env.js'

const app = new Hono()

app.use(
  '/api/auth/*',
  cors({
    origin: env.corsOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

app.get('/health', (c) => c.text('OK'))

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`auth listening on ${info.port}`)
})

// Drain on SIGTERM/SIGINT so Docker stops cleanly.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
