import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache static assets (if you want)
precacheAndRoute(self.__WB_MANIFEST);

// Cache API calls (optional)
registerRoute(
  ({ url }) => url.origin === 'https://smztesmqtbxesdzysntt.supabase.co',
  new StaleWhileRevalidate()
);

// Background sync for failed mutations
const bgSyncPlugin = new BackgroundSyncPlugin('syncQueue', {
  maxRetentionTime: 24 * 60, // retry for up to 24 hours
});

// We'll handle sync via a custom event listener
self.addEventListener('sync', event => {
  if (event.tag === 'syncQueue') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // We'll implement the actual sync in a separate module
  // We'll call a function exposed via clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TRIGGERED' });
  });
}