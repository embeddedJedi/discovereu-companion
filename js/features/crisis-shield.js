// js/features/crisis-shield.js
// Crisis Shield core data API.
//
// Lazily loads the four Crisis Shield JSON files once, memoises them in
// module-level closures, and exposes accessor + reference-resolver helpers
// used by the UI panel, compact card, and flowchart runner.
//
// Pure data layer — no DOM, no i18n, no side-effects beyond fetch caching.

import { loadJson } from '../data/loader.js';

// ─── Module-level cache ──────────────────────────────────────────────────────

let emergencyData = null;         // { version, countries: { ISO2: {...} } }
let trMissionsData = null;        // { version, note, ISO2: { countryName, missions: [...] }, ... }
let embassyLookupData = null;     // { version, defaultPattern, countries: { ISO2: {...} } }
let flowchartsData = null;        // { [flowId]: { title, startNode, nodes } }

let loaded = false;
let loadPromise = null;

// ─── Hard-coded fallbacks for resolveUrlRef ──────────────────────────────────
// NOTE: these may need later adjustment once canonical URLs are finalised.
const INTERRAIL_LOST_PASS_URL    = 'https://www.interrail.eu/en/help-faq';
const DISCOVEREU_SUPPORT_URL     = 'https://youth.europa.eu/discovereu_en';
const TRANSLATOR_PHARMACY_URL    = 'pages/hazirlik.js'; // in-app pharmacy phrases page

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Lazily fetch all four Crisis Shield JSON data files in parallel and cache
 * them in module-level closures. Concurrent callers share one promise.
 *
 *   await load();
 */
export async function load() {
  if (loaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = Promise.all([
    loadJson('emergency-numbers.json'),
    loadJson('tr-missions.json'),
    loadJson('embassy-lookup-pattern.json'),
    loadJson('crisis-flowcharts.json')
  ]).then(([emergency, missions, embassy, flows]) => {
    emergencyData     = emergency;
    trMissionsData    = missions;
    embassyLookupData = embassy;
    flowchartsData    = flows;
    loaded = true;
    loadPromise = null;
  }).catch(err => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

function assertLoaded() {
  if (!loaded) {
    throw new Error('[crisis-shield] data not loaded — call load() first');
  }
}

function normCountryId(id) {
  return typeof id === 'string' ? id.toUpperCase() : null;
}

// ─── Accessors ───────────────────────────────────────────────────────────────

/**
 * Return the emergency-numbers record for a 2-letter ISO country code
 * (uppercase input tolerated), or null if unknown.
 */
export function getEmergencyNumbers(countryId) {
  assertLoaded();
  const id = normCountryId(countryId);
  if (!id) return null;
  return emergencyData?.countries?.[id] ?? null;
}

/**
 * Return TR missions for a country as { countryName, missions: [...] } or null.
 * The underlying file keys top-level entries by ISO2 directly (plus meta keys
 * `version`, `lastVerified`, `note`).
 */
export function getTRMissions(countryId) {
  assertLoaded();
  const id = normCountryId(countryId);
  if (!id) return null;
  const entry = trMissionsData?.[id];
  if (!entry || typeof entry !== 'object' || !Array.isArray(entry.missions)) return null;
  return { countryName: entry.countryName ?? null, missions: entry.missions };
}

/**
 * Return the embassy-lookup pattern entry for a nationality (ISO2 of the
 * traveller's home country). Falls back to defaultPattern when unknown.
 */
export function getEmbassyLookup(nationality) {
  assertLoaded();
  const id = normCountryId(nationality);
  const entry = id ? embassyLookupData?.countries?.[id] : null;
  return entry ?? embassyLookupData?.defaultPattern ?? null;
}

/**
 * Return the DAG for "lost-passport" | "lost-card" | "medical-emergency"
 * (or any other flow id present in the file), or null if unknown.
 */
export function getFlowchart(flowId) {
  assertLoaded();
  if (!flowId || !flowchartsData) return null;
  return flowchartsData[flowId] ?? null;
}

// ─── Reference resolvers ─────────────────────────────────────────────────────

/**
 * Resolve a dot-path reference against the emergency-numbers data for a
 * specific country. Currently supports the `countryEmergency.<field>` namespace
 * where <field> is any key on the country record (police, ambulance, fire,
 * general, touristPolice, womenHelpline, lgbtqiSafeLine, poisonControl,
 * mentalHealth, ...). Returns the string value, or null if the country or
 * field is unknown / null.
 */
export function resolveNumberRef(ref, countryId) {
  assertLoaded();
  if (typeof ref !== 'string' || !ref.includes('.')) return null;
  const record = getEmergencyNumbers(countryId);
  if (!record) return null;

  const [ns, ...rest] = ref.split('.');
  if (ns !== 'countryEmergency' || rest.length === 0) return null;

  // Walk the remaining path against the country record.
  let cur = record;
  for (const seg of rest) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[seg];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : null;
}

/**
 * Resolve a URL reference against context. Supports:
 *   - "trMissions.nearestEmbassy"       → first mission's website / mapsUrl for ctx.countryId
 *   - "embassyLookup.currentNationality"→ embassy lookup URL for ctx.nationality
 *   - "interrail.lostPass"              → hard-coded Interrail help URL
 *   - "discoverEu.supportPortal"        → hard-coded DiscoverEU support URL
 *   - "translator.pharmacyPhrases"      → in-app pharmacy phrases page
 *
 * Returns a URL string, or null if unresolvable.
 */
export function resolveUrlRef(ref, ctx = {}) {
  assertLoaded();
  if (typeof ref !== 'string') return null;

  switch (ref) {
    case 'interrail.lostPass':           return INTERRAIL_LOST_PASS_URL;
    case 'discoverEu.supportPortal':     return DISCOVEREU_SUPPORT_URL;
    case 'translator.pharmacyPhrases':   return TRANSLATOR_PHARMACY_URL;

    case 'trMissions.nearestEmbassy': {
      const tr = getTRMissions(ctx.countryId);
      if (!tr || tr.missions.length === 0) return null;
      // Prefer a full embassy with a website, then any mission with a website,
      // then mapsUrl, else null.
      const byWebsite = tr.missions.find(m => m.type === 'embassy' && m.website)
                     ?? tr.missions.find(m => m.website);
      if (byWebsite?.website) return byWebsite.website;
      const byMaps = tr.missions.find(m => m.mapsUrl);
      return byMaps?.mapsUrl ?? null;
    }

    case 'embassyLookup.currentNationality': {
      const entry = getEmbassyLookup(ctx.nationality);
      if (!entry) return null;
      return entry.embassyListUrl || entry.mfaUrl || entry.fallbackUrl || null;
    }

    default:
      return null;
  }
}
