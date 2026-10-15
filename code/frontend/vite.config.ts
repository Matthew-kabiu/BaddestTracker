import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** Domain-dependent crawler assets and CSP always describe the same build. */
function siteMetadata(siteUrl: string): Plugin {
  const site = new URL(siteUrl)
  if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') {
    throw new Error('VITE_SITE_URL must be an HTTP(S) origin')
  }
  const origin = site.origin
  let hash = ''
  return {
    name: 'site-metadata',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const rendered = html.replaceAll('%VITE_SITE_URL%', origin)
        const json = rendered.match(/<script id="seo-structured-data" type="application\/ld\+json">([^<]+)<\/script>/)?.[1]
        if (!json) throw new Error('Missing SEO structured data')
        JSON.parse(json)
        hash = createHash('sha256').update(json).digest('base64')
        return rendered
      },
    },
    generateBundle: {
      // Vite renders index.html during its own generateBundle hook.
      order: 'post',
      handler() {
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n` })
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n` })
        if (!hash) throw new Error('SEO CSP hash was not generated')
        this.emitFile({ type: 'asset', fileName: 'seo-csp-hash.txt', source: hash })
      },
    },
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
  const siteUrl = config.VITE_SITE_URL
  if (!siteUrl) throw new Error('VITE_SITE_URL must be set (see .env.example)')
  return {
    plugins: [react(), tailwindcss(), siteMetadata(siteUrl)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    envDir: '../..',
    server: command === 'serve'
      ? {
          host: true,
          port: requiredPort('FRONTEND_PORT', config),
          strictPort: true,
          watch: { usePolling: true },
          hmr: { clientPort: requiredPort('FRONTEND_HOST_PORT', config) },
        }
      : undefined,
    build: { target: 'es2022', sourcemap: false },
  }
})
