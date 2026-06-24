const STATE_CACHE = 'fargo-app-state-v1';
const STATE_URL = '/__fargo_app_state__';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { type, state } = event.data ?? {};

  if (type === 'SAVE_STATE') {
    event.waitUntil(
      caches.open(STATE_CACHE).then((cache) =>
        cache.put(STATE_URL, new Response(JSON.stringify(state ?? {}), {
          headers: { 'Content-Type': 'application/json' },
        }))
      )
    );
    return;
  }

  if (type === 'LOAD_STATE') {
    event.waitUntil(
      caches.open(STATE_CACHE).then(async (cache) => {
        const response = await cache.match(STATE_URL);
        const savedState = response ? await response.json() : null;
        event.ports[0]?.postMessage({ state: savedState });
      })
    );
  }
});
