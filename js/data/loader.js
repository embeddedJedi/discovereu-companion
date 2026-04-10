// js/data/loader.js
// Fetch-and-cache JSON data files. In-memory cache (no re-fetch per session).
// Also knows how to hydrate the central state store from a manifest.

import { state } from '../state.js';

const BASE = new URL('../../data/', import.meta.url);
const inflight = new Map();   // path -> Promise<data>
const memo = new Map();       // path -> data (resolved)

/**
 * Fetch a JSON file from /data. Results are memoised for the life of the page,
 * so repeated calls reuse the same promise and the same parsed object.
 *
 *   const countries = await loadJson('countries.json');
 */
export async function loadJson(path) {
  if (memo.has(path)) return memo.get(path);
  if (inflight.has(path)) return inflight.get(path);

  const url = new URL(path, BASE).toString();
  const promise = fetch(url, { credentials: 'omit' })
    .then(res => {
      if (!res.ok) throw new Error(`[loader] ${path} → HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      memo.set(path, data);
      inflight.delete(path);
      return data;
    })
    .catch(err => {
      inflight.delete(path);
      throw err;
    });

  inflight.set(path, promise);
  return promise;
}

/**
 * Invalidate the in-memory cache for a path (forces next load to refetch).
 * Useful for dev reloads; not normally needed in production.
 */
export function invalidate(path) {
  memo.delete(path);
  inflight.delete(path);
}

// ─────────────────────────────────────────────────────────────────────────────
// State hydration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the core data bundle needed for the map + country panel + route.
 * Each file is optional — if any is missing or 404s, a warning is logged and
 * the corresponding state slice stays at its default ([]). This keeps the app
 * usable during the early bootstrap phase when some JSONs aren't written yet.
 *
 *   await loadCoreData();
 */
export async function loadCoreData() {
  const manifest = [
    { path: 'countries.json',       slice: 'countries',       extract: d => d.countries ?? d },
    { path: 'trains.json',          slice: 'trains',          extract: d => d.trains ?? d },
    { path: 'reservations.json',    slice: 'reservations',    extract: d => d.reservations ?? d },
    { path: 'route-templates.json', slice: 'routeTemplates',  extract: d => d.templates ?? d.routes ?? d }
  ];

  const results = await Promise.allSettled(
    manifest.map(entry => loadJson(entry.path).then(entry.extract))
  );

  results.forEach((res, i) => {
    const { slice, path } = manifest[i];
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      state.set(slice, res.value);
    } else if (res.status === 'rejected') {
      console.warn(`[loader] ${path} unavailable — ${slice} slice left empty`, res.reason?.message || res.reason);
    }
  });

  return state.get();
}

/**
 * Load the Europe GeoJSON. Kept separate from loadCoreData because it's
 * larger (~300 KB) and only the map layer needs it.
 *
 *   const geojson = await loadEuropeGeoJson();
 */
export async function loadEuropeGeoJson() {
  return loadJson('geojson/europe.geojson');
}
