// Runs before React, then follows SPA navigation without touching feature components.
(() => {
  const canonical = document.querySelector('link[rel="canonical"]')
  const site = new URL(canonical.href)
  const description = document.querySelector('meta[name="description"]')
  const publicDescription = description.content
  const structuredData = document.getElementById('seo-structured-data')
  const publicMetadata = Array.from(document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]'))
  const fallback = document.querySelector('#root > main')

  function update(pathname) {
    const home = pathname === site.pathname
    const production = window.location.origin === site.origin
    document.title = home ? 'Baddest Tracker | Private To-Dos, Notes & AI' : 'Baddest Tracker'
    document.querySelector('meta[name="robots"]').content = home && production
      ? 'index, follow, max-image-preview:large'
      : 'noindex, nofollow, noarchive'
    description.content = home ? publicDescription : 'Access your private Baddest Tracker account.'

    if (home) {
      document.head.append(canonical, structuredData, ...publicMetadata)
    } else {
      canonical.remove()
      structuredData.remove()
      publicMetadata.forEach((element) => element.remove())
      // Do not show homepage fallback copy on a direct account or unknown URL.
      fallback?.remove()
    }
  }

  update(window.location.pathname)
  window.addEventListener('baddest:route-change', (event) => update(event.detail.pathname))
})()
