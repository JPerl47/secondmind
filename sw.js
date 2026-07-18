/* SecondMind service worker — offline shell + cached assets */
const CACHE = 'secondmind-v19';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon.png', 'icon-512.png', 'mark.png', 'logo.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept the live API or map tiles
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('openstreetmap') || url.hostname.includes('nominatim')) return;

  // App navigation: network-first, fall back to cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./', copy));
        return r;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // Same-origin assets + CDN libs: cache-first with background refresh
  const cacheable = url.origin === location.origin ||
    url.hostname === 'esm.sh' || url.hostname === 'cdnjs.cloudflare.com' ||
    url.hostname.endsWith('jsdelivr.net');
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
