// js/map/route-layer.js
// Owns all route rendering on the Leaflet map: outbound + return polylines,
// stop markers, home marker. Subscribes to state.route + state.user + state.theme.

/* global L */

import { state } from '../state.js';
import { resolveHomeCoords } from '../ui/home-city-picker.js';

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
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === countryId);
  if (!country) return null;
  const city = (country.cities || []).find(c => c.id === cityId) || country.cities?.[0];
  return city ? [city.lat, city.lng] : null;
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
    iconSize: [28, 28], iconAnchor: [14, 14]
  });
}

export function renderRouteLayer(map) {
  if (!window.L || !map) return;
  clearLayers(map);

  const route = state.getSlice('route');
  const home = resolveHomeCoords();
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

  const accent  = cssVar('--accent')   || '#3b82f6';
  const accent2 = cssVar('--accent-2') || '#ef4444';

  outboundLayer = L.polyline(outboundLatLngs, {
    color: accent, weight: 3, dashArray: '8,6', opacity: 0.9
  }).addTo(map);

  returnLayer = L.polyline(returnLatLngs, {
    color: accent2, weight: 2.5, dashArray: '4,10', opacity: 0.85
  }).addTo(map);

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
