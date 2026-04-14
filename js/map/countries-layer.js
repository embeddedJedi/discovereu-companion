// js/map/countries-layer.js
// Renders Europe country polygons onto a Leaflet map.
// Wires click/hover/keyboard focus → updates `selectedCountry` in state.
// Keeps a { id -> Leaflet layer } index so other modules can drive styling.

/* global L */

import { state, countryById } from '../state.js';
import { loadEuropeGeoJson } from '../data/loader.js';
import { matchesFilters, filtersActive } from './filters.js';

let geoLayer = null;
const layersById = new Map();  // ISO-A2 → L.Path

const BASE_CLASS = 'country-polygon';

/**
 * Add the country polygon layer to the given map and return the Leaflet
 * GeoJSON layer. Safe to call once after map init.
 *
 *   const layer = await initCountriesLayer(map);
 */
export async function initCountriesLayer(map) {
  if (geoLayer) return geoLayer;

  const geojson = await loadEuropeGeoJson();

  geoLayer = L.geoJSON(geojson, {
    style: featureStyle,
    onEachFeature: (feature, layer) => {
      const id = featureId(feature);
      if (!id) return;
      layersById.set(id, layer);

      // Accessible label for screen readers + tooltip on hover
      const name = feature.properties?.name || id;
      layer.bindTooltip(name, {
        sticky: true,
        direction: 'top',
        className: 'country-tooltip',
        offset: [0, -4]
      });

      layer.on({
        click: () => selectCountry(id),
        mouseover: (ev) => highlightLayer(ev.target),
        mouseout:  (ev) => unhighlightLayer(ev.target, id),
        keypress:  (ev) => {
          if (ev.originalEvent?.key === 'Enter' || ev.originalEvent?.key === ' ') {
            selectCountry(id);
          }
        }
      });

      // Make polygon focusable for keyboard navigation
      const el = layer.getElement?.();
      if (el) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', name);
      }
    }
  }).addTo(map);

  // Apply initial state classes (non-participating, in-route, etc.)
  restyleAll();

  // Re-style whenever selection / filters / route change
  state.subscribe('selectedCountry', restyleAll);
  state.subscribe('route',           restyleAll);
  state.subscribe('filters',         restyleAll);
  state.subscribe('countries',       restyleAll);

  return geoLayer;
}

/** Programmatically select a country (from map click, search, or a link). */
export function selectCountry(id) {
  if (!id) return;
  state.set('selectedCountry', id);
  state.set('panelOpen', true);
  document.dispatchEvent(new CustomEvent('countryclick', { detail: { countryId: id } }));
}

/** Get the Leaflet layer for a country id (or null). */
export function getCountryLayer(id) {
  return layersById.get(id) || null;
}

/** Look up the (English) display name from the GeoJSON feature for an id. */
export function getFeatureName(id) {
  const layer = layersById.get(id);
  return layer?.feature?.properties?.name || null;
}

/** Fit the map view to a specific country's bounds. */
export function focusCountry(map, id, options = {}) {
  const layer = layersById.get(id);
  if (!layer) return false;
  map.fitBounds(layer.getBounds(), {
    padding: [40, 40],
    maxZoom: 6,
    animate: true,
    ...options
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────────────────

function featureId(feature) {
  const p = feature?.properties || {};
  return (p.id || p.ISO_A2 || p.iso_a2 || '').toUpperCase() || null;
}

// State classes we toggle on and off as selection / route / filters change.
// BASE_CLASS is applied once via Leaflet's `className` option and left alone
// so Leaflet's own `leaflet-interactive` class is preserved.
const STATE_CLASSES = ['selected', 'in-route', 'in-return-route', 'filter-match', 'non-participating'];

function featureStyle() {
  return {
    className: BASE_CLASS,
    weight: 0.75,
    fillOpacity: 1
  };
}

function restyleLayer(layer, id) {
  const el = layer.getElement?.();
  if (!el) return;

  const country = countryById(id);
  const sel = state.getSlice('selectedCountry');
  const route = state.getSlice('route');
  const filters = state.getSlice('filters');

  const wanted = new Set();
  if (!country || country.discoverEU === false) wanted.add('non-participating');
  if (sel === id) wanted.add('selected');
  const inOutbound = !!route?.stops?.some(s => s.countryId === id);
  const inReturn   = !!route?.returnStops?.some(s => s.countryId === id);
  if (inOutbound)               wanted.add('in-route');
  else if (inReturn)            wanted.add('in-return-route');
  if (country && filtersActive(filters) && matchesFilters(country, filters)) {
    wanted.add('filter-match');
  }

  STATE_CLASSES.forEach(cls => el.classList.toggle(cls, wanted.has(cls)));
}

function restyleAll() {
  if (!geoLayer) return;
  geoLayer.eachLayer(layer => {
    const id = featureId(layer.feature);
    if (id) restyleLayer(layer, id);
  });
}

function highlightLayer(layer) {
  const el = layer.getElement?.();
  if (el && !el.classList.contains('selected')) {
    layer.bringToFront?.();
  }
}

function unhighlightLayer(layer /* , id */) {
  // CSS :hover handles the visual state; nothing to reset in JS.
  // We keep the function so `mouseout` binding is explicit and symmetrical.
  void layer;
}
