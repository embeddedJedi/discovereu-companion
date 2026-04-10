// js/utils/share.js
// Round-trip a route through a shareable URL hash. Uses LZ-string's
// encoded-URIComponent variant so the output is URL-safe and compact
// (a 15-stop route fits under ~180 characters — no gist fallback needed).
//
// URL shape:  https://host/#route=<lz-compressed-json>
// We stay on the hash so GitHub Pages doesn't need any routing config.

/* global LZString */

import { state } from '../state.js';

const HASH_KEY = 'route';

// Only share the fields that matter for rebuilding the itinerary —
// ephemeral flags (transport mode defaults, arrivalDay placeholders)
// are left out so a shared link stays short.
function compactRoute(route) {
  return {
    n: route?.name || '',
    d: route?.travelDaysLimit ?? 7,
    s: (route?.stops || []).map(s => ({
      c: s.countryId,
      k: Math.max(1, Number(s.nights) || 1)
    }))
  };
}

function expandRoute(compact) {
  const stops = Array.isArray(compact?.s) ? compact.s : [];
  return {
    name: compact?.n || '',
    travelDaysLimit: compact?.d ?? 7,
    seatCreditsLimit: 4,
    stops: stops.map(s => ({
      countryId: s.c,
      cityId: null,
      nights: Math.max(1, Number(s.k) || 1),
      arrivalDay: null,
      transport: 'train'
    }))
  };
}

/** Encode a route into a URL-safe short string. Returns '' on failure. */
export function encodeRoute(route) {
  if (typeof LZString === 'undefined') return '';
  try {
    const json = JSON.stringify(compactRoute(route));
    return LZString.compressToEncodedURIComponent(json);
  } catch (e) {
    console.warn('[share] encode failed', e);
    return '';
  }
}

/** Decode the URL-safe string back into a route object. Returns null on failure. */
export function decodeRoute(encoded) {
  if (typeof LZString === 'undefined' || !encoded) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return expandRoute(JSON.parse(json));
  } catch (e) {
    console.warn('[share] decode failed', e);
    return null;
  }
}

/**
 * Build the full shareable URL for the current route, based on the page
 * origin + pathname. Falls back to `#route=` alone if origin is missing.
 */
export function currentShareURL(route = state.getSlice('route')) {
  const encoded = encodeRoute(route);
  if (!encoded) return '';
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${HASH_KEY}=${encoded}`;
}

/**
 * Read the current location hash, decode a route if present, and apply it.
 * Call once after `loadCoreData()` so the countries list is already in
 * state by the time the route hydrates.
 */
export function hydrateRouteFromHash() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return false;

  const route = decodeRoute(encoded);
  if (!route || !Array.isArray(route.stops) || route.stops.length === 0) return false;

  state.update('route', prev => ({ ...prev, ...route }));
  state.set('panelTab', 'route');
  state.set('panelOpen', true);
  return true;
}

/**
 * Copy the current share URL to the clipboard. Returns a Promise<boolean>.
 * Silently falls back to the legacy execCommand API for non-secure contexts.
 */
export async function copyCurrentURL() {
  const url = currentShareURL();
  if (!url) return false;

  // Update the hash in-place too, so the address bar reflects what was
  // copied — and reloads keep the same state.
  try { history.replaceState(null, '', url); } catch {}

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch { /* fall through */ }
  }

  // Legacy fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
