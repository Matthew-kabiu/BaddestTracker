import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * The public origin is a runtime value. The production image renders `__SITE_URL__`, robots.txt,
 * sitemap.xml and the JSON-LD CSP hash from SITE_URL when the container starts (docker/15-site.envsh).
 * The dev server stands in for that step with the same variable and blocks crawlers.
 */
function devSiteMetadata(siteUrl: string): Plugin {
  const site = new URL(siteUrl)
  if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') {
    throw new Error('SITE_URL must be an HTTP(S) origin')
  }
  return {
    name: 'dev-site-metadata',
    apply: 'serve',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site.origin),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain')
          res.end('User-agent: *\nDisallow: /\n')
        } else next()
      })
    },
  }
}

function requiredPort(name: string, config: Record<string, string | undefined>): number {
  const raw = config[name]
  const port = Number(raw)
  if (!raw || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${name} must be set to a valid port (see .env.example)`)
  }
  return port
}

export default defineConfig(({ command, mode }) => {
  const config = { ...loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), ''), ...process.env }
  // The dev server needs the runtime variables; `vite build` and vitest do not.
  const serve = command === 'serve' && !process.env.VITEST
  if (serve && !config.SITE_URL) throw new Error('SITE_URL must be set (see .env.example)')
  return {
    plugins: [react(), tailwindcss(), ...(serve ? [devSiteMetadata(config.SITE_URL!)] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    envDir: '../..',
    server: serve
      ? {
          host: true,
          port: requiredPort('FRONTEND_PORT', config),
          strictPort: true,
          watch: { usePolling: true },
          hmr: { clientPort: requiredPort('FRONTEND_HOST_PORT', config) },
          // Same-origin /api in every environment: nginx proxies in production, Vite here.
          // Longer prefix first; Vite takes the first matching key.
          proxy: {
            '/api/auth': { target: `http://auth:${requiredPort('AUTH_PORT', config)}` },
            '/api': { target: `http://backend:${requiredPort('BACKEND_PORT', config)}` },
          },
        }
      : undefined,
    build: { target: 'es2022', sourcemap: false },
  }
})
