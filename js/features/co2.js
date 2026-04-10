// js/features/co2.js
// CO₂ comparison between taking the train (DiscoverEU's default) and
// flying the same itinerary. The calculation is intentionally simple so
// it can be shown inline without a loading spinner.
//
// Emission factors (grams of CO₂ per passenger-km) are European
// averages from the European Environment Agency and ICCT, mid-2020s:
//   • Rail (EU mix, mostly electrified)         ≈ 35 g/pkm
//   • Short-haul flight (<1500 km, incl. LTO)   ≈ 255 g/pkm
//
// Distances use great-circle haversine between each country's capital
// city. That's imprecise (real trips do not fly between capitals), but
// the whole point of the number is the *ratio*, not a shipping quote.

const RAIL_G_PER_KM  = 35;
const FLIGHT_G_PER_KM = 255;
const EARTH_KM = 6371;

// Rough capital coordinates for every country in data/countries.json.
// Kept inline because this is the only module that needs them; if more
// features start asking, it's an easy move to data/countries.json.
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
 * Compute the CO₂ comparison between taking the train and flying a given
 * route. Returns zeros for a zero- or one-stop route so the UI has a
 * stable shape.
 *
 *   const { rail, flight, savedKg, savedPct, green } = computeCO2(route);
 */
export function computeCO2(route) {
  const stops = route?.stops || [];
  if (stops.length < 2) {
    return { totalKm: 0, railKg: 0, flightKg: 0, savedKg: 0, savedPct: 0, green: false };
  }

  let totalKm = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = CAPITAL_LATLNG[stops[i].countryId];
    const b = CAPITAL_LATLNG[stops[i + 1].countryId];
    if (!a || !b) continue;
    totalKm += haversineKm(a[0], a[1], b[0], b[1]);
  }

  const railKg   = (totalKm * RAIL_G_PER_KM)   / 1000;
  const flightKg = (totalKm * FLIGHT_G_PER_KM) / 1000;
  const savedKg  = flightKg - railKg;
  const savedPct = flightKg > 0 ? savedKg / flightKg : 0;

  return {
    totalKm:  Math.round(totalKm),
    railKg:   Math.round(railKg),
    flightKg: Math.round(flightKg),
    savedKg:  Math.round(savedKg),
    savedPct: Math.round(savedPct * 100),
    green:    savedPct >= 0.75
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}
