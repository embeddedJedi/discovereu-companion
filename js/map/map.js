// js/map/map.js
// Minimal Leaflet initialization.
// Country layer, labels, and filters are wired in follow-up modules.

/* global L */

let map = null;

const EUROPE_BOUNDS = [
  [34.0, -11.0],  // SW: south of Spain / Greece
  [71.0, 41.0]    // NE: north of Norway / east of Finland
];

const INITIAL_VIEW = {
  center: [51.0, 10.0],  // central Europe
  zoom: 4
};

export function initMap() {
  const container = document.getElementById('map');
  if (!container) return null;

  map = L.map(container, {
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    minZoom: 3,
    maxZoom: 10,
    maxBounds: EUROPE_BOUNDS,
    maxBoundsViscosity: 0.8,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false,
    preferCanvas: false
  });

  // Placeholder attribution until data layers are added
  map.attributionControl.addAttribution(
    '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
  );

  // Future: loadCountriesLayer(map), loadLabelsLayer(map), loadFiltersBinding(map)

  // Invalidate size after CSS paint so the map fills the container
  requestAnimationFrame(() => map.invalidateSize());

  return map;
}

export function getMap() { return map; }
