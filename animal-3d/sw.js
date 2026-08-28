const TIGER_URL = 'https://storage.googleapis.com/ar-answers-in-search-models/static/Tiger/model.glb';
const TIGER_LOCAL = './models/tiger.glb';

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.href === TIGER_URL) {
    event.respondWith((async () => {
      const local = await fetch(new URL(TIGER_LOCAL, self.registration.scope), { cache: 'no-store' });
      if (local.ok) return local;
      return fetch(event.request);
    })());
  }
});
