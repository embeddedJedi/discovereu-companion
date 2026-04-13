// js/router.js
// Lightweight hash-based SPA router.
// Routes: #/map, #/hazirlik, #/kesfet
// Nested: #/map/DE — parsed as { page, sub }

const PAGES = ['map', 'rehber', 'kesfet', 'hazirlik', 'impact', 'coach', 'group'];
const DEFAULT_PAGE = 'map';
const listeners = new Set();

/**
 * Parse a location.hash into { page, sub, params }.
 *   "#/guide/DE"  → { page: 'guide', sub: 'DE', params: {} }
 *   "#/map"       → { page: 'map',   sub: null,  params: {} }
 *   "#route=abc"  → { page: 'map',   sub: null,  params: { route: 'abc' } }
 *   ""            → { page: 'map',   sub: null,  params: {} }
 */
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');

  // Legacy share URL: #route=...
  if (raw.startsWith('route=')) {
    return { page: 'map', sub: null, params: { route: raw.slice(6) } };
  }

  // Split query string off first so routes like "group?g=..." still parse.
  const qIdx = raw.indexOf('?');
  const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const queryPart = qIdx >= 0 ? raw.slice(qIdx + 1) : '';

  const segments = pathPart.split('/').filter(Boolean);
  const page = PAGES.includes(segments[0]) ? segments[0] : DEFAULT_PAGE;
  const sub = segments[1] || null;

  const params = {};
  if (queryPart) {
    try {
      new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
    } catch (_) { /* noop */ }
  }
  return { page, sub, params };
}

/** Navigate to a page, optionally with a sub-route. */
export function navigate(page, sub = null) {
  const path = sub ? `#/${page}/${sub}` : `#/${page}`;
  if (location.hash === path) return;
  history.pushState(null, '', path);
  _notify();
}

/** Get the current parsed route. */
export function getCurrentRoute() {
  return parseHash();
}

/** Subscribe to route changes. Returns unsubscribe function. */
export function onRouteChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** List of valid page names. */
export { PAGES };

function _notify() {
  const route = parseHash();
  listeners.forEach(cb => {
    try { cb(route); } catch (e) { console.error('[router]', e); }
  });
}

// Listen to browser back/forward
window.addEventListener('hashchange', _notify);
