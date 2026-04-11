// js/features/inclusion-data.js
// Pluggable adapter for Tier 3 Inclusion Pack data. Phase 1 reads from
// three static JSON snapshots; Phase 2 will layer live Wheelmap REST
// responses on top without changing any consumer signatures.
//
// IMPORTANT: cache-hit rule — once data is loaded, all accessor
// functions return synchronously. Never schedule a .then() callback
// on the cache-hit path: that is the bug we fixed in turkish-bonus.js
// (commit ea7b67e) and it will infinite-loop any renderer that
// re-invokes these functions on state updates.

import { loadJson } from '../data/loader.js';

let rainbowIndex = null;           // { [countryId]: entry }
let accessibilityIndex = null;     // { [countryId]: entry }
let emergencyData = null;          // full object (not indexed — small)
let loadPromise = null;

function indexById(list) {
  const out = {};
  for (const item of list || []) out[item.id] = item;
  return out;
}

/**
 * Trigger the one-shot load of all three datasets. Safe to call many
 * times — the in-flight promise is shared, and after resolution all
 * accessor functions are synchronous cache hits.
 */
export async function ensureInclusionData() {
  if (rainbowIndex && accessibilityIndex && emergencyData) return;
  if (loadPromise) return loadPromise;
  loadPromise = Promise.allSettled([
    loadJson('rainbow-map.json').then(d => { rainbowIndex = indexById(d.countries); }),
    loadJson('accessibility.json').then(d => { accessibilityIndex = indexById(d.countries); }),
    loadJson('emergency-phrases.json').then(d => { emergencyData = d; })
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const names = ['rainbow-map.json', 'accessibility.json', 'emergency-phrases.json'];
        console.warn(`[inclusion] ${names[i]} unavailable`, r.reason?.message || r.reason);
      }
    });
    loadPromise = null;
  });
  return loadPromise;
}

/** Synchronous after first load. Returns null if data unavailable. */
export function getRainbowData(countryId) {
  return rainbowIndex?.[countryId] || null;
}

/** Synchronous after first load. Returns null if data unavailable. */
export function getAccessibilityData(countryId) {
  return accessibilityIndex?.[countryId] || null;
}

/**
 * Returns { country, universal, userLang } or null if unavailable.
 * userLang is the caller's current i18n language for fallback phrases.
 */
export function getEmergencyInfo(countryId, userLang) {
  if (!emergencyData) return null;
  const country = emergencyData.countries?.find(c => c.id === countryId) || null;
  return {
    country,
    universal: emergencyData.universalEu,
    globalPhrases: emergencyData.globalPhrases,
    userLang
  };
}

/**
 * Returns a 0..1 normalised value for the map colour layer.
 * mode: 'rainbow' → ILGA overallScore / 100
 *       'accessibility' → overallScore / 5
 *       anything else → 0
 * Returns null when data for that country is unavailable.
 */
export function inclusionLayerValue(countryId, mode) {
  if (mode === 'rainbow') {
    const rd = getRainbowData(countryId);
    if (!rd || rd.overallScore == null) return null;
    return rd.overallScore / 100;
  }
  if (mode === 'accessibility') {
    const ad = getAccessibilityData(countryId);
    if (!ad || ad.overallScore == null) return null;
    return ad.overallScore / 5;
  }
  return null;
}

/** Summary statistics for the Inclusion tab's default (no country) view. */
export function inclusionSummaryStats() {
  const stats = {
    rainbowAverage: null,
    marriageEqualityCount: 0,
    selfDeterminationCount: 0,
    accessibleStationsCount: 0,
    disabilityCardCount: 0,
    totalCountries: 0
  };
  if (!rainbowIndex || !accessibilityIndex) return stats;

  const countries = Object.values(rainbowIndex);
  const scoreSum = countries.reduce((n, c) => n + (c.overallScore || 0), 0);
  stats.totalCountries = countries.length;
  stats.rainbowAverage = countries.length ? Math.round(scoreSum / countries.length) : 0;
  stats.marriageEqualityCount   = countries.filter(c => c.keyItems?.marriageEquality).length;
  stats.selfDeterminationCount  = countries.filter(c => c.keyItems?.selfDeterminationGender).length;

  for (const a of Object.values(accessibilityIndex)) {
    if (a.trainStations?.barrierFreePercent >= 80) stats.accessibleStationsCount++;
    if (a.disabilityCard?.euDisabilityCardAccepted) stats.disabilityCardCount++;
  }
  return stats;
}
