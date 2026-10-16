# Public-site SEO

Canonical site: `SITE_URL` in the selected root environment file, read when the frontend container starts. Production domain values belong only in `.env.production`; the built image carries none.

- `code/frontend/index.html` contains the landing title, description, canonical URL, Open Graph/Twitter tags, and WebSite/WebApplication JSON-LD. Social crawlers receive these without running React. The origin is the placeholder `__SITE_URL__` in the build; `docker/15-site.envsh` renders it from `SITE_URL` at container start, and the Vite dev server renders it from the same variable.
- The initial root contains a small static landing introduction for readers/crawlers without JavaScript. React replaces it on startup; it is not a second hidden landing page.
- `public/seo-init.js` applies noindex to non-home routes before React starts, removes homepage metadata from account/unknown pages, and restores it when returning home. It also prevents indexing on a different origin, such as local development.
- `src/main.tsx` sends route-change notifications through the router subscription. Feature components do not manage SEO.
- Nginx sends `X-Robots-Tag: noindex, nofollow, noarchive` for account/dashboard/unknown URLs. Only `/` is indexable. Public assets have no robots header.
- `robots.txt` is written at container start from `SITE_URL`. It keeps assets and account pages crawlable so bots can see noindex; `/api/` is excluded. Development blocks all crawlers. Robots rules are not authentication.
- `sitemap.xml` lists only the public homepage. Add only real, canonical, publicly indexable pages, not auth routes or dashboard data.
- `public/social-preview.png` is the 1200-by-630 sharing image. No invented ratings, reviews or pricing are included in schema.
- The nginx startup hook hashes the rendered JSON-LD and exports it before `docker/security-headers.conf.template` is rendered. A domain change is a container restart with a new `SITE_URL`, which updates the canonical, crawler files and CSP together. Do not enable arbitrary inline scripts.

After deployment, verify the public domain, crawler files, social image and response headers; then submit the sitemap in Google Search Console. Deployment and Search Console submission are not performed by this local implementation.
