// js/features/meeting-point.js
// Geometric-median meeting-point solver for the multi-origin group planner.
// Pure math module: no DOM, no fetch, no window. Node + browser portable.

// TODO(v1.8): haversineKm is duplicated here (also in co2.js, impact-compute.js,
// night-shield.js). Extract into js/utils/geo.js in a future refactor pass.

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two (lat, lng) pairs in kilometres.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in km
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Arithmetic mean of a set of {lat, lng} points. Baseline for comparison
 * against the Weiszfeld L1-optimal median.
 * @param {Array<{lat:number,lng:number}>} points
 * @returns {{lat:number, lng:number}}
 */
export function centroid(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('no-points');
  }
  let sLat = 0;
  let sLng = 0;
  for (const p of points) {
    sLat += p.lat;
    sLng += p.lng;
  }
  return { lat: sLat / points.length, lng: sLng / points.length };
}

/**
 * Compute the geometric median (L1-optimal meeting point) via Weiszfeld's
 * iterative algorithm. Minimises sum of Euclidean lat/lng distances — a good
 * approximation for the great-circle sum at continental scales.
 *
 * Edge cases:
 *  - empty input  -> throws Error('no-points')
 *  - single point -> returns that point, iterations=0, converged=true
 *  - iterate on a vertex -> epsilon perturbation avoids division by zero
 *
 * @param {Array<{lat:number,lng:number}>} points
 * @param {{maxIters?:number, epsilon?:number}} [opts]
 * @returns {{lat:number, lng:number, iterations:number, converged:boolean}}
 */
export function weiszfeldMedian(points, opts = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('no-points');
  }
  const maxIters = opts.maxIters ?? 200;
  const epsilon = opts.epsilon ?? 1e-7;

  if (points.length === 1) {
    return {
      lat: points[0].lat,
      lng: points[0].lng,
      iterations: 0,
      converged: true,
    };
  }

  // Seed with arithmetic centroid.
  let { lat, lng } = centroid(points);
  let iterations = 0;
  let converged = false;

  for (let i = 0; i < maxIters; i++) {
    let sumW = 0;
    let sumLat = 0;
    let sumLng = 0;

    for (const p of points) {
      const dLat = p.lat - lat;
      const dLng = p.lng - lng;
      // Euclidean distance in lat/lng space. Perturb with epsilon to avoid
      // division by zero when current iterate coincides with a vertex.
      const d = Math.sqrt(dLat * dLat + dLng * dLng) || epsilon;
      const w = 1 / d;
      sumW += w;
      sumLat += p.lat * w;
      sumLng += p.lng * w;
    }

    const newLat = sumLat / sumW;
    const newLng = sumLng / sumW;
    iterations = i + 1;

    const shift = Math.sqrt((newLat - lat) ** 2 + (newLng - lng) ** 2);
    lat = newLat;
    lng = newLng;

    if (shift < epsilon) {
      converged = true;
      break;
    }
  }

  return { lat, lng, iterations, converged };
}

/**
 * Snap a freeform {lat, lng} to the nearest city in countries.json.
 * Optionally pre-filter to a set of DiscoverEU-eligible country IDs.
 *
 * @param {{lat:number,lng:number}} latLng
 * @param {{countries: Array<{id:string, cities?:Array<{id:string,name:string,lat:number,lng:number}>}>}} countries
 *        Parsed countries.json root object.
 * @param {{eligibleCountryIds?: Set<string>}} [options]
 * @returns {{cityId:string, countryId:string, cityName:string, distanceKm:number}}
 */
export function snapToCity(latLng, countries, options = {}) {
  const root = countries && Array.isArray(countries.countries)
    ? countries.countries
    : countries;
  if (!Array.isArray(root)) {
    throw new Error('no-cities-available');
  }

  const filter = options.eligibleCountryIds instanceof Set
    ? options.eligibleCountryIds
    : null;

  let best = null;
  let bestDist = Infinity;

  for (const country of root) {
    if (!country || !Array.isArray(country.cities)) continue;
    if (filter && !filter.has(country.id)) continue;
    for (const city of country.cities) {
      if (typeof city.lat !== 'number' || typeof city.lng !== 'number') continue;
      const d = haversineKm(latLng.lat, latLng.lng, city.lat, city.lng);
      if (d < bestDist) {
        bestDist = d;
        best = {
          cityId: city.id,
          countryId: country.id,
          cityName: city.name,
          distanceKm: d,
        };
      }
    }
  }

  if (!best) throw new Error('no-cities-available');
  return best;
}

/**
 * Full meeting-point analysis: Weiszfeld median + centroid baseline,
 * snapped to nearest (eligible) DiscoverEU city, with saved-km metric.
 *
 * @param {Array<{lat:number,lng:number}>} memberCoords
 * @param {{eligibleCountryIds?: Set<string>, countries: object}} ctx
 * @returns {{
 *   weiszfeld: {lat:number,lng:number,iterations:number,converged:boolean},
 *   centroid:  {lat:number,lng:number},
 *   snapped:   {cityId:string,countryId:string,cityName:string,distanceKm:number},
 *   totalDistanceKm: number,
 *   savedKmVsCentroid: number
 * }}
 */
export function computeMeetingPoint(memberCoords, ctx) {
  if (!Array.isArray(memberCoords) || memberCoords.length === 0) {
    throw new Error('no-points');
  }
  if (!ctx || !ctx.countries) {
    throw new Error('no-cities-available');
  }

  const weiszfeld = weiszfeldMedian(memberCoords);
  const centroidPt = centroid(memberCoords);

  const snapOpts = ctx.eligibleCountryIds
    ? { eligibleCountryIds: ctx.eligibleCountryIds }
    : {};
  const snapped = snapToCity(
    { lat: weiszfeld.lat, lng: weiszfeld.lng },
    ctx.countries,
    snapOpts
  );

  // Also snap the arithmetic centroid so we can report true km saved by
  // picking the L1-optimal city rather than the mean-based one.
  const centroidSnapped = snapToCity(centroidPt, ctx.countries, snapOpts);

  let totalDistanceKm = 0;
  let totalCentroidKm = 0;
  // Pull lat/lng of snapped cities from the countries tree.
  const root = Array.isArray(ctx.countries.countries)
    ? ctx.countries.countries
    : ctx.countries;
  const findCity = (countryId, cityId) => {
    const c = root.find((x) => x.id === countryId);
    return c && c.cities ? c.cities.find((y) => y.id === cityId) : null;
  };
  const snappedCity = findCity(snapped.countryId, snapped.cityId);
  const centroidCity = findCity(centroidSnapped.countryId, centroidSnapped.cityId);

  for (const m of memberCoords) {
    if (snappedCity) {
      totalDistanceKm += haversineKm(m.lat, m.lng, snappedCity.lat, snappedCity.lng);
    }
    if (centroidCity) {
      totalCentroidKm += haversineKm(m.lat, m.lng, centroidCity.lat, centroidCity.lng);
    }
  }

  return {
    weiszfeld,
    centroid: centroidPt,
    snapped,
    totalDistanceKm,
    savedKmVsCentroid: totalCentroidKm - totalDistanceKm,
  };
}
