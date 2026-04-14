// js/map/route-layer.js
// Owns all route rendering on the Leaflet map: outbound + return polylines,
// stop markers, home marker. Subscribes to state.route + state.user + state.theme.

/* global L */

import { state } from '../state.js';
import { resolveHomeCoords } from '../ui/home-city-picker.js';

// Capital fallback for the 33 DiscoverEU countries whose countries.json
// entries don't carry city-level coords (only TR currently has cities[]).
// Keeps the polyline + arrows working even when the route's stop has no
// matching inline city record.
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

let outboundLayer = null;
let returnLayer = null;
let markersLayer = null;
let decorators = [];

function clearLayers(map) {
  if (outboundLayer) { map.removeLayer(outboundLayer); outboundLayer = null; }
  if (returnLayer)   { map.removeLayer(returnLayer);   returnLayer = null; }
  if (markersLayer)  { map.removeLayer(markersLayer);  markersLayer = null; }
  decorators.forEach(d => map.removeLayer(d));
  decorators = [];
}

function cityCoords(countryId, cityId) {
  if (!countryId) return null;
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === countryId || c.id === String(countryId).toUpperCase());
  // Prefer inline city record when present (only TR today).
  if (country && Array.isArray(country.cities)) {
    const city = country.cities.find(c => c.id === cityId) || country.cities[0];
    if (city && typeof city.lat === 'number') return [city.lat, city.lng];
  }
  // Fallback to capital lookup keyed by uppercase 2-letter ISO.
  const key = String(countryId).toUpperCase();
  const cap = CAPITAL_LATLNG[key];
  return cap ? [cap[0], cap[1]] : null;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// divIcon HTML is built from static strings and numeric indexes only.
// Never interpolate user input into this helper.
function markerIcon(klass, label) {
  const safeLabel = String(label).replace(/[<>&"']/g, '');
  return L.divIcon({
    className: klass,
    html: `<div class="${klass}-inner">${safeLabel}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17]
  });
}

export function renderRouteLayer(map) {
  if (!window.L || !map) return;
  clearLayers(map);

  const route = state.getSlice('route');
  let home = resolveHomeCoords();
  // Fallback: when the home country has no inline cities[] (true for 32/33
  // countries today), resolveHomeCoords returns null. Use the capital lookup
  // so the polyline + arrows still render.
  if (!home) {
    const user = state.getSlice('user') || {};
    const key = String(user.homeCountry || '').toUpperCase();
    const cap = CAPITAL_LATLNG[key];
    if (cap) home = { lat: cap[0], lng: cap[1], name: user.homeCity || key };
  }
  if (!route?.stops?.length || !home) return;

  const homeLatLng = [home.lat, home.lng];
  const outboundLatLngs = [
    homeLatLng,
    ...route.stops.map(s => cityCoords(s.countryId, s.cityId)).filter(Boolean)
  ];

  const returnLatLngs = [
    outboundLatLngs[outboundLatLngs.length - 1],
    ...(route.returnStops || []).map(s => cityCoords(s.countryId, s.cityId)).filter(Boolean),
    homeLatLng
  ];

  // Return often overlaps the outbound path (e.g. single-stop trips where
  // home→A outbound and A→home return are the same geodesic). Build a
  // curved polyline that bulges perpendicular to each segment so the two
  // directions are always visually separable even when they share a hat.
  const curveSegment = (a, b, bulge = 0.18, steps = 14) => {
    const [lat1, lng1] = a, [lat2, lng2] = b;
    const mx = (lat1 + lat2) / 2, my = (lng1 + lng2) / 2;
    const dx = lat2 - lat1, dy = lng2 - lng1;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular offset (rotate 90° clockwise in lat/lng space).
    const ox = mx + (dy / len) * len * bulge;
    const oy = my - (dx / len) * len * bulge;
    const pts = [];
    for (let t = 0; t <= steps; t++) {
      const u = t / steps, v = 1 - u;
      pts.push([
        v * v * lat1 + 2 * v * u * ox + u * u * lat2,
        v * v * lng1 + 2 * v * u * oy + u * u * lng2
      ]);
    }
    return pts;
  };
  const curvedReturn = [];
  for (let i = 0; i < returnLatLngs.length - 1; i++) {
    const arc = curveSegment(returnLatLngs[i], returnLatLngs[i + 1]);
    if (i === 0) curvedReturn.push(...arc);
    else curvedReturn.push(...arc.slice(1));
  }

  // Outbound = warm gold, solid heavy line. Return = cool teal, dashed thinner
  // line. Distinct hue + line style so colourblind users can also tell them
  // apart at a glance.
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  // Light mode: deep EU blue for line + arrows.
  // Dark mode: warm gold so the outbound path pops against the near-black map.
  const accent  = isDark ? (cssVar('--eu-gold-400') || '#ffbb00')
                         : (cssVar('--eu-blue-700') || '#1f35a0');
  const accent2 = cssVar('--accent-teal') || '#0d9488';

  outboundLayer = L.polyline(outboundLatLngs, {
    color: accent, weight: 4, opacity: 0.95
  }).addTo(map);

  returnLayer = L.polyline(curvedReturn, {
    color: accent2, weight: 3, dashArray: '2,8', opacity: 0.9
  }).addTo(map);

  // Directional arrowheads — one centered arrow per segment so short legs
  // still show direction. Guarded so offline / CDN-blocked environments
  // gracefully degrade to plain dashed polylines.
  if (L.polylineDecorator) {
    const arrowSymbol = (color, size, polygon) => L.Symbol.arrowHead({
      pixelSize: size,
      polygon,
      pathOptions: { stroke: true, color, fill: polygon, fillColor: color, fillOpacity: polygon ? 1 : 0, weight: 2, opacity: 1 }
    });
    const decorateSegments = (latlngs, color, opts) => {
      for (let i = 0; i < latlngs.length - 1; i++) {
        const seg = L.polyline([latlngs[i], latlngs[i + 1]]);
        const dec = L.polylineDecorator(seg, {
          patterns: [{ offset: '50%', repeat: 0, symbol: arrowSymbol(color, opts.size, opts.polygon) }]
        }).addTo(map);
        decorators.push(dec);
      }
    };
    // Outbound: solid filled triangle, larger. Dark ink colour so the arrow
    // reads clearly against the gold line instead of blending into it.
    decorateSegments(outboundLatLngs, accent, { size: 18, polygon: true });
    // Return: hollow chevron along the curved path so the arrows ride the
    // bulged polyline instead of the straight chord.
    const returnArrow = L.polylineDecorator(L.polyline(curvedReturn), {
      patterns: [{ offset: '25%', repeat: '50%', symbol: arrowSymbol(accent2, 14, false) }]
    }).addTo(map);
    decorators.push(returnArrow);
  }

  markersLayer = L.layerGroup().addTo(map);

  L.marker(homeLatLng, {
    title: home.name,
    icon: L.divIcon({
      className: 'home-marker',
      html: '<div class="home-marker-inner">\u{1F3E0}</div>',
      iconSize: [32, 32], iconAnchor: [16, 16]
    })
  }).addTo(markersLayer);

  route.stops.forEach((stop, i) => {
    const c = cityCoords(stop.countryId, stop.cityId);
    if (!c) return;
    L.marker(c, { title: String(i + 1), icon: markerIcon('stop-marker-outbound', i + 1) }).addTo(markersLayer);
  });

  (route.returnStops || []).forEach((stop, i) => {
    const c = cityCoords(stop.countryId, stop.cityId);
    if (!c) return;
    const letter = String.fromCharCode(65 + (i % 26));
    L.marker(c, { title: letter, icon: markerIcon('stop-marker-return', letter) }).addTo(markersLayer);
  });
}

let initialized = false;

export function initRouteLayer(map) {
  if (initialized || !map) return;
  initialized = true;
  renderRouteLayer(map);
  state.subscribe('route', () => renderRouteLayer(map));
  state.subscribe('user',  () => renderRouteLayer(map));
  state.subscribe('theme', () => renderRouteLayer(map));
}
