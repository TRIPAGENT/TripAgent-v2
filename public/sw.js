/*
 * The app's service worker.
 *
 * TripAgent is sent as a link and kept on a home screen, so it has to behave
 * like something installed: open instantly, survive a tunnel or a plane, and
 * never show a browser error page to a member.
 *
 * What is cached, and what is deliberately not:
 *
 *   - The app shell (HTML, JS, CSS, fonts, icons) is cached and served
 *     stale-while-revalidate, so a return visit paints immediately.
 *   - Photography and the city guides under /img and /data are cached on first
 *     use and kept: they are large, immutable and expensive on a hotel wifi.
 *   - Anything under /agent — the member's session, the Desk, requests, quotes,
 *     the Concierge — is NEVER cached. A stale price or a stale request status
 *     would be a lie, and this app's whole position is that it does not tell
 *     them. Those calls go to the network and are allowed to fail honestly.
 */
const VERSION = 'v1'
const SHELL = `tripagent-shell-${VERSION}`
const MEDIA = `tripagent-media-${VERSION}`

/** Enough to open the door offline. Everything else arrives as it is used. */
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/img/brand/door.jpg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isMedia = (url) => url.pathname.startsWith('/img/') || url.pathname.startsWith('/data/')
const isAgent = (url) => url.pathname.startsWith('/agent') || url.pathname.startsWith('/api')

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // The Desk, the Concierge, the member's session: always live, never cached.
  if (isAgent(url) || url.origin !== self.location.origin) return

  // A navigation always resolves to the shell — this is a single-page app, so
  // every route is index.html, and offline it must still open.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
    )
    return
  }

  // Photography and guides: cache-first and kept. They do not change in place.
  if (isMedia(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(MEDIA).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // The rest of the shell: serve what we have, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => hit)
      return hit ?? live
    }),
  )
})
