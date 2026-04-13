// sw.js — DiscoverEU Companion service worker
// Strategy:
//   • Pre-cache the CSS + HTML app shell on install
//   • On fetch (GET, same-origin): cache-first with a silent network
//     refresh so the next visit picks up new code, but offline still
//     works from the cache
//   • On activate: wipe any older cache buckets so version bumps roll
//     out cleanly

const CACHE_VERSION = 'discovereu-v10';
const APP_SHELL = [
  './',
  './index.html',
  './css/design-system.css',
  './css/main.css',
  './css/components.css',
  './css/map.css',
  './css/a11y.css',
  './css/a11y-lowbw.css',
  './css/impact.css',
  '/js/features/low-bw.js',
  '/js/features/voice-transcribe.js',
  '/js/features/a11y-settings.js',
  '/js/map/wheelchair-layer.js',
  '/data/wheelmap-metro-index.json',
  '/js/ui/a11y-panel.js',
  '/pages/accessibility-demo.html',
  '/pages/impact.html',
  '/data/impact-public.json',
  '/js/impact-public-renderer.js',
  '/js/features/impact-compute.js',
  '/js/features/impact-card.js',
  '/js/features/impact-anonymize.js',
  '/js/features/impact-export.js',
  '/js/ui/impact-panel.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon.svg',
  './assets/manifest.json',
  '/data/rainbow-map.json',
  '/data/accessibility.json',
  '/data/emergency-phrases.json',
  '/js/features/inclusion-data.js',
  '/js/map/inclusion-layer.js',
  '/js/ui/inclusion.js',
  '/js/ui/welcome-wizard.js',
  '/data/guides.json',
  '/data/bingo-challenges.json',
  '/data/daily-dares.json',
  '/data/soundtracks.json',
  '/data/tr-consulates.json',
  '/js/utils/ics.js',
  '/js/utils/image.js',
  '/js/features/llm-groq.js',
  '/js/features/ai-assistant.js',
  '/js/features/bingo.js',
  '/js/features/daily-dare.js',
  '/js/features/future-me.js',
  '/js/features/soundtrack.js',
  '/js/ui/ai-modal.js',
  '/js/ui/guide.js',
  '/js/ui/bingo-tab.js',
  '/js/ui/fun-tab.js',
  '/data/emergency-numbers.json',
  '/data/tr-missions.json',
  '/data/embassy-lookup-pattern.json',
  '/data/crisis-flowcharts.json',
  '/css/crisis-shield.css',
  '/js/features/crisis-shield.js',
  '/js/features/flowchart-runner.js',
  '/js/features/share-location.js',
  '/js/ui/crisis-shield-panel.js',
  '/js/ui/emergency-dial-list.js',
  '/data/buddy-cities.json',
  '/css/buddy.css',
  '/js/features/buddy.js',
  '/js/features/buddy-consent.js',
  '/js/ui/buddy-panel.js',
  '/js/features/coach.js',
  '/js/features/coach-prompt.js',
  '/js/features/coach-badge.js',
  '/js/features/quiz-runner.js',
  '/js/ui/coach-panel.js',
  '/css/coach.css',
  '/data/coach-badge-issuer.json',
  '/badges/issuer.json',
  '/badges/classes/at.json',
  '/badges/classes/de.json',
  '/badges/classes/fr.json',
  '/badges/classes/es.json',
  '/badges/classes/it.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[sw] precache partial', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests. CDN assets (Leaflet, Chart.js,
  // LZ-string) are served with their own long-lived cache headers.
  if (url.origin !== location.origin) return;

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}
