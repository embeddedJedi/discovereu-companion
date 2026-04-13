// js/features/impact-compute.js
// v1.4 Impact Dashboard — SINGLE SOURCE OF TRUTH for both the user-facing
// impact card and the anonymised aggregate contribution payload.
//
// This module is a PURE compute layer:
//   • no DOM access
//   • no LocalStorage / IndexedDB / network
//   • reads state only via the argument passed in (default: state.get())
//
// The personal snapshot shape is deliberately stable; downstream modules
// (impact-card.js, impact-export.js) depend on it and any change here
// must ripple through them.

import { state } from '../state.js';
import { computeCO2 } from './co2.js';
import { getEffectiveLegs } from './effective-legs.js';
import { computeSeatCredits } from './seat-credits.js';

// Budget tier → costPerDay key in data/countries.json.
// user.budget is 'budget' | 'moderate' | 'comfort'; countries.json exposes
// costPerDay.{low,mid,high} per country. Map once, consistently.
const BUDGET_TIER = {
  budget:   'low',
  moderate: 'mid',
  comfort:  'high'
};

// Capital coordinates for haversine leg distances. Duplicated from co2.js
// because co2.js keeps them module-local. TODO: extract to utils/math.js
// (or utils/geo.js) once a second consumer lands — see co2.js line ~23.
// Keeping in sync by eyeball is acceptable for 36 static rows.
const CAPITAL_LATLNG = {
  AL: [41.33,  19.82], AT: [48.21,  16.37], BA: [43.87,  18.42], BE: [50.85,   4.35],
  BG: [42.70,  23.32], CH: [46.95,   7.45], CY: [35.17,  33.37], CZ: [50.08,  14.43],
  DE: [52.52,  13.40], DK: [55.68,  12.57], EE: [59.44,  24.75], ES: [40.42,  -3.70],
  FI: [60.17,  24.94], FR: [48.85,   2.35], GR: [37.98,  23.73], HR: [45.81,  15.98],
  HU: [47.50,  19.04], IE: [53.35,  -6.26], IS: [64.14, -21.94], IT: [41.90,  12.48],
  LI: [47.14,   9.52], LT: [54.69,  25.28], LU: [49.61,   6.13], LV: [56.95,  24.11],
  MK: [41.99,  21.43], MT: [35.90,  14.51], NL: [52.37,   4.89], NO: [59.91,  10.75],
  PL: [52.23,  21.01], PT: [38.72,  -9.14], RO: [44.43,  26.10], RS: [44.79,  20.45],
  SE: [59.33,  18.07], SI: [46.06,  14.51], SK: [48.15,  17.11], TR: [41.01,  28.98]
};

const EARTH_KM = 6371;

/**
 * Compute the canonical impact snapshot.
 *
 * Async because the meta.hash is produced via Web Crypto (SubtleCrypto).
 *
 * @param {object} [snapshot] Full state snapshot (defaults to `state.get()`).
 * @returns {Promise<{
 *   personal: {
 *     countriesVisited: number,
 *     totalKm: number,
 *     co2Rail: number,
 *     co2Flight: number,
 *     co2Saved: number,
 *     estimatedLocalSpend: number,
 *     languagesTouched: string[],
 *     a11yFeaturesUsed: string[],
 *     bingoCompleted: number,
 *     seatCreditsUsed: number
 *   },
 *   meta: { timestamp: string, hash: string }
 * }>}
 */
export async function computeImpact(snapshot = state.get()) {
  const route     = snapshot?.route     || { stops: [], returnStops: [] };
  const user      = snapshot?.user      || {};
  const bingo     = snapshot?.bingo     || { completed: {} };
  const countries = snapshot?.countries || [];

  // Effective legs honour the "include return in budget" toggle so the
  // impact numbers match what the rest of the app shows the user.
  const legs = getEffectiveLegs(route);

  // Distinct country count across all effective legs (outbound + return).
  const countriesVisited = new Set(
    legs.map(s => s && s.countryId).filter(Boolean)
  ).size;

  // Total km via haversine between consecutive legs.
  let totalKm = 0;
  for (let i = 0; i < legs.length - 1; i++) {
    const a = CAPITAL_LATLNG[legs[i].countryId];
    const b = CAPITAL_LATLNG[legs[i + 1].countryId];
    if (!a || !b) continue;
    totalKm += haversineKm(a[0], a[1], b[0], b[1]);
  }

  // Delegate CO2 math to the canonical module. computeCO2 runs its own
  // getEffectiveLegs pass internally, so the numbers stay consistent
  // with the route card.
  const co2 = computeCO2(route);
  const co2Rail   = co2.railKg;
  const co2Flight = co2.flightKg;
  const co2Saved  = Math.max(0, co2Flight - co2Rail);

  // Estimated local spend = Σ(nights × country.costPerDay[tier]).
  // Covers the local economy contribution angle for the impact card.
  const tierKey = BUDGET_TIER[user.budget] || 'mid';
  const countryById = new Map(countries.map(c => [c.id, c]));
  let estimatedLocalSpend = 0;
  for (const stop of legs) {
    if (!stop || !stop.nights) continue;
    const c = countryById.get(stop.countryId);
    const daily = c?.costPerDay?.[tierKey];
    if (typeof daily === 'number') estimatedLocalSpend += stop.nights * daily;
  }
  estimatedLocalSpend = Math.round(estimatedLocalSpend);

  // Distinct primary language per visited country.
  const langSet = new Set();
  for (const stop of legs) {
    const c = countryById.get(stop.countryId);
    const lang = c?.languages?.[0];
    if (lang) langSet.add(lang);
  }
  const languagesTouched = [...langSet].sort();

  // Future-proof placeholder: a11y feature usage will be tracked when
  // dedicated counters land (Wheelmap lookups, accessibility filter
  // toggles, etc.). See plan Task 2 Step 3 — `inclusion.*` fields.
  const a11yFeaturesUsed = [];

  // Bingo completions — count truthy entries (schema: { [id]: true }).
  const bingoCompleted = Object.values(bingo.completed || {})
    .filter(Boolean).length;

  const seatCredits = computeSeatCredits(route);
  const seatCreditsUsed = seatCredits.used;

  const personal = {
    countriesVisited,
    totalKm: Math.round(totalKm),
    co2Rail,
    co2Flight,
    co2Saved,
    estimatedLocalSpend,
    languagesTouched,
    a11yFeaturesUsed,
    bingoCompleted,
    seatCreditsUsed
  };

  const meta = {
    timestamp: new Date().toISOString(),
    hash: await hashPayload(personal)
  };

  return { personal, meta };
}

/**
 * SHA-256 hex digest of a JSON-serialised object. Used to detect changes
 * between snapshots (state.impact.lastSnapshotHash) and to dedupe
 * anonymous aggregate contributions server-side.
 *
 * @param {unknown} obj Any JSON-serialisable value.
 * @returns {Promise<string>} Lowercase hex digest (64 chars).
 */
export async function hashPayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Great-circle distance. Duplicated from co2.js (which keeps it private).
// TODO: extract to utils/math.js when a third consumer appears.
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}
