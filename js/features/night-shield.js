// js/features/night-shield.js
// Night Arrival Shield — walks a route's stops, estimates arrival times,
// and flags any stop that lands in the "night window" (22:00 - 06:00).
//
// Pure functions. No DOM, no state coupling. Consumers (route-builder,
// filters-ui) import and render the results themselves.
//
// Algorithm:
//   • Day 1 departs the first stop at 08:00 local.
//   • For every leg N → N+1 look up a duration in trains.json
//     (match by country pair, bidirectional). If no match, fall back to
//     a haversine estimate between capitals at a conservative 80 km/h
//     average (includes transfers + waiting).
//   • Add the leg duration to the running clock. If the arrival hour
//     is >= 22 or < 6, flag the stop as a late arrival.
//   • After arriving, the traveller sleeps; the next leg departs at
//     08:00 the following morning (the `nights` spent in a stop is
//     already captured by the Route tab, this module is purely about
//     the arrival moment).

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR   = 6;
const DEFAULT_DEPART_HOUR = 8;
const FALLBACK_SPEED_KMH  = 80;   // realistic door-to-door rail average
const EARTH_KM = 6371;

// Capital coordinates — mirrors js/features/co2.js. Duplicated on purpose
// to keep night-shield a leaf module with no cross-feature imports.
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

/**
 * Walk the route's stops and decide which arrivals land at night.
 *
 * @param {{stops:Array}} route  The route slice from state.
 * @param {Array} trainsData     Optional array of {fromCountry,toCountry,duration,…}.
 * @returns {Array<{cityId:string, countryId:string, arrivalEstimate:string, isLate:boolean, durationHours:number}>}
 *   One entry per stop. The first stop has `isLate=false` and
 *   `arrivalEstimate="08:00"` (the conventional day-1 departure anchor).
 */
export function checkNightArrivals(route, trainsData = []) {
  const stops = route?.stops || [];
  if (stops.length === 0) return [];

  const results = [];
  // Day 1 starts at 08:00 at the first stop — call that the arrival.
  let clockHour = DEFAULT_DEPART_HOUR;

  results.push({
    cityId:    stops[0].cityId || null,
    countryId: stops[0].countryId,
    arrivalEstimate: formatHHMM(clockHour),
    isLate:    false,
    durationHours: 0
  });

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to   = stops[i + 1];
    const durationHours = estimateLegHours(from, to, trainsData);

    // Each new leg departs the next morning at 08:00.
    clockHour = DEFAULT_DEPART_HOUR + durationHours;
    // Fold into 0-24 range so the "hour of day" check is correct.
    const arrivalHour = ((clockHour % 24) + 24) % 24;

    results.push({
      cityId:    to.cityId || null,
      countryId: to.countryId,
      arrivalEstimate: formatHHMM(arrivalHour),
      isLate:    isNightHour(arrivalHour),
      durationHours: Math.round(durationHours * 10) / 10
    });
  }

  return results;
}

/**
 * Convenience wrapper: is a specific stop (by index OR reference) a late
 * arrival on the given route?
 *
 * @param {number|object} stop  Either the index of the stop in route.stops,
 *                              or the stop object itself.
 * @param {{stops:Array}} route
 * @param {Array} trainsData
 * @returns {boolean}
 */
export function isLateStop(stop, route, trainsData = []) {
  const arrivals = checkNightArrivals(route, trainsData);
  const stops = route?.stops || [];
  const index = typeof stop === 'number'
    ? stop
    : stops.indexOf(stop);
  if (index < 0 || index >= arrivals.length) return false;
  return !!arrivals[index].isLate;
}

/**
 * Does this route contain any late-arrival stop?
 * Handy for filtering templates.
 */
export function hasLateArrival(route, trainsData = []) {
  return checkNightArrivals(route, trainsData).some(r => r.isLate);
}

// ─── Internals ───────────────────────────────────────────────────────────

function estimateLegHours(from, to, trainsData) {
  const match = findTrain(from, to, trainsData);
  if (match && Number.isFinite(match.duration)) {
    return Number(match.duration);
  }
  // Fallback: haversine / speed.
  const a = CAPITAL_LATLNG[from.countryId];
  const b = CAPITAL_LATLNG[to.countryId];
  if (!a || !b) return 6;  // last-resort default: a half-day of travel
  const km = haversineKm(a[0], a[1], b[0], b[1]);
  return km / FALLBACK_SPEED_KMH;
}

function findTrain(from, to, trainsData) {
  if (!Array.isArray(trainsData) || trainsData.length === 0) return null;
  return trainsData.find(t => {
    const forward = t.fromCountry === from.countryId && t.toCountry === to.countryId;
    const reverse = t.fromCountry === to.countryId   && t.toCountry === from.countryId;
    if (!forward && !reverse) return false;
    // If cities are known, prefer a city-level match but don't require it.
    if (from.cityId && to.cityId && t.fromCity && t.toCity) {
      const cityForward = t.fromCity === from.cityId && t.toCity === to.cityId;
      const cityReverse = t.fromCity === to.cityId   && t.toCity === from.cityId;
      return cityForward || cityReverse;
    }
    return true;
  }) || null;
}

function isNightHour(hour) {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function formatHHMM(hourFloat) {
  const hh = Math.floor(hourFloat) % 24;
  const mm = Math.round((hourFloat - Math.floor(hourFloat)) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}
