// js/map/map.js
// Minimal Leaflet initialization.
// Country layer, labels, and filters are wired in follow-up modules.

/* global L */

import { initRouteLayer } from './route-layer.js';

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

  // Wire route polyline + arrow layer immediately — previously wired from
  // pages/map.js mount, which could miss the first render when the SPA
  // mounted the map page before state was ready. Idempotent.
  initRouteLayer(map);

  // Invalidate size after CSS paint so the map fills the container.
  // Route layer is re-rendered here too: the initial render inside
  // initRouteLayer ran while the map container still had 0x0 dimensions
  // (Leaflet silently drops projected coords), so polylines + markers
  // appeared empty. Re-rendering once size is valid fixes it.
  requestAnimationFrame(() => {
    map.invalidateSize();
    import('./route-layer.js').then(m => m.renderRouteLayer(map));
  });

  return map;
}

export function getMap() { return map; }
