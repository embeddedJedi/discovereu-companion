/**
 * impact-anonymize.js
 *
 * k-anonymity stripper for DiscoverEU Companion impact snapshots.
 *
 * Pure ES module. Works in both browser and Node — no browser-only APIs
 * (no `window`, `document`, `fetch`, `crypto.subtle`, `localStorage`).
 *
 * Public API:
 *   anonymize(snapshot)                    -> anonymised single record
 *   mergeContributions(records, { k = 5 }) -> aggregated public dataset
 *
 * Plan-compat aliases (docs/superpowers/plans/2026-04-13-impact-dashboard.md §Task 5):
 *   toContributionShape(snapshot) === anonymize(snapshot)
 *   applyKAnonymity(records, k)   -> array-level k-anonymity pass
 */

/* ------------------------------------------------------------------ */
/* Rounding helpers                                                   */
/* ------------------------------------------------------------------ */

function roundTo(value, step) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.round(Number(value) / step) * step;
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value) || 0);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function sortedUnique(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.filter((x) => typeof x === "string"))).sort();
}

/* ------------------------------------------------------------------ */
/* Whitelist                                                          */
/* ------------------------------------------------------------------ */

const PERSONAL_WHITELIST = [
  "countriesVisited",
  "totalKm",
  "co2Saved",
  "estimatedLocalSpend",
  "languagesTouched",
  "a11yFeaturesUsed",
  "bingoCompleted",
  "seatCreditsUsed",
];

/* ------------------------------------------------------------------ */
/* anonymize(snapshot)                                                */
/* ------------------------------------------------------------------ */

/**
 * Convert a personal snapshot into a public-safe single record.
 * Accepts either the flat personal shape or `{ personal, meta }`.
 */
export function anonymize(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new TypeError("anonymize: snapshot must be an object");
  }

  const personal =
    snapshot.personal && typeof snapshot.personal === "object"
      ? snapshot.personal
      : snapshot;
  const meta = snapshot.meta && typeof snapshot.meta === "object" ? snapshot.meta : {};

  // Build record from whitelist only — any other field is dropped.
  const record = {
    countriesVisited: clampInt(personal.countriesVisited, 0, 33),
    totalKm: roundTo(personal.totalKm, 100),
    co2Saved: roundTo(personal.co2Saved, 10),
    estimatedLocalSpend: roundTo(personal.estimatedLocalSpend, 100),
    languagesTouched: Array.isArray(personal.languagesTouched)
      ? personal.languagesTouched.length
      : clampInt(personal.languagesTouched, 0, 50),
    a11yFeaturesUsed: sortedUnique(personal.a11yFeaturesUsed),
    bingoCompleted: clampInt(personal.bingoCompleted, 0, 100),
    seatCreditsUsed: clampInt(personal.seatCreditsUsed, 0, 4),
  };

  // meta: keep hash only (for dedup), drop timestamp.
  if (typeof meta.hash === "string" && meta.hash.length) {
    record.meta = { hash: meta.hash };
  }

  return record;
}

// Plan-compat alias.
export const toContributionShape = anonymize;

/* ------------------------------------------------------------------ */
/* Statistics helpers                                                 */
/* ------------------------------------------------------------------ */

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Suppress histogram bins with fewer than `k` entries.
 * Returns { kept, suppressedCount } where kept is a new {[bin]: count} object.
 */
function suppressRareBins(histogram, k) {
  const kept = {};
  let suppressed = 0;
  for (const [bin, count] of Object.entries(histogram)) {
    if (count >= k) {
      kept[bin] = count;
    } else {
      suppressed += count;
    }
  }
  return { kept, suppressed };
}

/* ------------------------------------------------------------------ */
/* mergeContributions(records, { k })                                 */
/* ------------------------------------------------------------------ */

export function mergeContributions(records, options = {}) {
  const k = Number.isInteger(options.k) && options.k > 0 ? options.k : 5;

  if (!Array.isArray(records)) {
    throw new TypeError("mergeContributions: records must be an array");
  }

  const inputCount = records.length;

  // Quasi-identifier fingerprint for record-level k-anonymity:
  // any exact combination of (countriesVisited, languagesTouched,
  // bingoCompleted, seatCreditsUsed, a11yFeaturesUsed) that appears
  // fewer than k times is considered too rare to include.
  const fingerprintOf = (r) =>
    [
      r.countriesVisited,
      r.languagesTouched,
      r.bingoCompleted,
      r.seatCreditsUsed,
      (r.a11yFeaturesUsed || []).join("|"),
    ].join("::");

  const fpCounts = Object.create(null);
  for (const r of records) {
    const fp = fingerprintOf(r);
    fpCounts[fp] = (fpCounts[fp] || 0) + 1;
  }

  const kept = [];
  let droppedForKAnonymity = 0;
  for (const r of records) {
    if (fpCounts[fingerprintOf(r)] >= k) {
      kept.push(r);
    } else {
      droppedForKAnonymity += 1;
    }
  }

  // Aggregate over kept records.
  const totalTrips = kept.length;
  const countrySet = new Set();
  let totalCo2 = 0;
  let totalKm = 0;
  let totalSpend = 0;
  const langs = [];

  const bingoHistRaw = Object.create(null);
  const seatHistRaw = Object.create(null);
  const a11yHistRaw = Object.create(null);

  for (const r of kept) {
    countrySet.add(r.countriesVisited);
    totalCo2 += Number(r.co2Saved) || 0;
    totalKm += Number(r.totalKm) || 0;
    totalSpend += Number(r.estimatedLocalSpend) || 0;
    langs.push(Number(r.languagesTouched) || 0);

    const bKey = String(r.bingoCompleted);
    bingoHistRaw[bKey] = (bingoHistRaw[bKey] || 0) + 1;

    const sKey = String(r.seatCreditsUsed);
    seatHistRaw[sKey] = (seatHistRaw[sKey] || 0) + 1;

    for (const feature of r.a11yFeaturesUsed || []) {
      a11yHistRaw[feature] = (a11yHistRaw[feature] || 0) + 1;
    }
  }

  // k-anonymity pass on histogram bins.
  const bingo = suppressRareBins(bingoHistRaw, k);
  const seat = suppressRareBins(seatHistRaw, k);
  const a11y = suppressRareBins(a11yHistRaw, k);

  const languageDiversity = langs.length
    ? { min: Math.min(...langs), max: Math.max(...langs), median: median(langs) }
    : { min: 0, max: 0, median: 0 };

  const suppressionTotal =
    droppedForKAnonymity + bingo.suppressed + seat.suppressed;
  const kAnonymitySafe =
    inputCount === 0 ? true : suppressionTotal / inputCount <= 0.1;

  return {
    totalTrips,
    totalCountriesCovered: countrySet.size,
    totalCo2Saved: totalCo2,
    totalKm,
    totalEstimatedSpend: totalSpend,
    languageDiversity,
    bingoCompletedHistogram: bingo.kept,
    seatCreditsHistogram: seat.kept,
    a11yFeatureAdoption: a11y.kept,
    kAnonymitySafe,
    droppedForKAnonymity,
    meta: {
      version: "impact-public/1.0",
      generatedAt: new Date().toISOString(),
      inputCount,
      k,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Plan-compat: applyKAnonymity(records, k)                           */
/* ------------------------------------------------------------------ */

/**
 * Array-level k-anonymity pass from the original plan.
 * Returns a new array where records whose quasi-identifier combo
 * appears < k times have their `a11yFeaturesUsed` generalised and
 * their `countriesVisited` bucketed; if still < k, the record is dropped.
 */
export function applyKAnonymity(records, k = 5) {
  if (!Array.isArray(records)) {
    throw new TypeError("applyKAnonymity: records must be an array");
  }
  const kk = Number.isInteger(k) && k > 0 ? k : 5;

  const bucketCountries = (n) => {
    if (n <= 2) return "1-2";
    if (n <= 4) return "3-4";
    if (n <= 7) return "5-7";
    return "8+";
  };

  const fp = (r) =>
    [
      r.countriesVisited,
      r.languagesTouched,
      (r.a11yFeaturesUsed || []).join("|"),
    ].join("::");

  const counts = Object.create(null);
  for (const r of records) {
    const key = fp(r);
    counts[key] = (counts[key] || 0) + 1;
  }

  // First pass: generalise rare ones.
  const pass1 = records.map((r) => {
    if (counts[fp(r)] >= kk) return r;
    return {
      ...r,
      a11yFeaturesUsed: ["<generalised>"],
      countriesVisitedBucket: bucketCountries(r.countriesVisited),
    };
  });

  // Recount after generalisation.
  const fp2 = (r) =>
    [
      r.countriesVisitedBucket || r.countriesVisited,
      r.languagesTouched,
      (r.a11yFeaturesUsed || []).join("|"),
    ].join("::");

  const counts2 = Object.create(null);
  for (const r of pass1) {
    const key = fp2(r);
    counts2[key] = (counts2[key] || 0) + 1;
  }

  return pass1.filter((r) => counts2[fp2(r)] >= kk);
}
