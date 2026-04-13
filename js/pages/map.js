// js/pages/map.js
// Map page: full-screen Leaflet map + overlay elements.
// Country detail is handled by the side panel (wired in main.js).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, qs, empty } from '../utils/dom.js';
import { getMap } from '../map/map.js';
import { initRouteLayer } from '../map/route-layer.js';
import { toggleLayer as togglePickpocketLayer } from '../features/pickpocket.js';
import { createWheelchairLayer } from '../map/wheelchair-layer.js';
import { createGreenHostelsLayer } from '../map/green-hostels-layer.js';
import { shouldDefer } from '../features/low-bw.js';

let overlayEl = null;
let chipStripEl = null;
let layerControlsEl = null;
let pickpocketOn = false;
let wheelchairApi = null;   // lazy: { enable, disable, isEnabled } from createWheelchairLayer
let wheelchairOn = false;
let greenHostelsApi = null; // lazy: createGreenHostelsLayer
let greenHostelsOn = false;
let unsubscribers = [];

function routeCountryIds() {
  const route = state.getSlice('route') || {};
  const ids = new Set();
  (route.stops || []).forEach(s => s.countryId && ids.add(s.countryId));
  (route.returnStops || []).forEach(s => s.countryId && ids.add(s.countryId));
  return ids;
}

function routeCityIds() {
  const route = state.getSlice('route') || {};
  const ids = new Set();
  (route.stops || []).forEach(s => s.cityId && ids.add(s.cityId));
  (route.returnStops || []).forEach(s => s.cityId && ids.add(s.cityId));
  return ids;
}

export function mount(container) {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'block';

  // Initialize route rendering layer (idempotent — guarded inside the module).
  const map = getMap();
  if (map) initRouteLayer(map);

  // Low-bandwidth gate: the app currently renders only GeoJSON country
  // polygons (no raster tile layer). If a CartoDB / OSM tile layer is
  // added here in the future, wrap the addLayer call, e.g.:
  //   if (map && !shouldDefer('map-tiles')) { map.addLayer(tileLayer); }
  // The gate is consulted per-mount so the user can flip the flag
  // without a reload.
  void shouldDefer;

  overlayEl = h('div', { class: 'map-overlays' });
  container.appendChild(overlayEl);

  renderRouteSummary();

  chipStripEl = h('div', { class: 'chip-strip' });
  overlayEl.appendChild(chipStripEl);
  renderChipStrip();

  // Layer toggle controls (pickpocket heatmap, future: rainbow/accessibility)
  layerControlsEl = h('div', { class: 'layer-toggles' });
  overlayEl.appendChild(layerControlsEl);
  renderLayerToggles();

  // Initial sync: if a11y.wheelchairLayer was persisted as true, enable layer now.
  syncWheelchairFromState();
  syncGreenHostelsFromState();

  unsubscribers.push(
    state.subscribe('route', () => {
      renderRouteSummary();
      renderChipStrip();
      syncWheelchairFromState();
      syncGreenHostelsFromState();
    }),
    state.subscribe('language', () => { renderRouteSummary(); renderChipStrip(); renderLayerToggles(); }),
    state.subscribe('a11y', () => { syncWheelchairFromState(); }),
    state.subscribe('filters', () => { syncGreenHostelsFromState(); })
  );
}

/**
 * State-driven wheelchair layer binding. Reads `a11y.wheelchairLayer` and
 * enables/disables the Leaflet layer. Also re-runs when `route` changes so
 * the country filter stays in sync with the user's stops.
 */
async function syncWheelchairFromState() {
  const map = getMap();
  if (!map) return;
  const want = !!(state.getSlice('a11y') || {}).wheelchairLayer;

  if (want && !wheelchairApi) {
    try { wheelchairApi = createWheelchairLayer(map); }
    catch (err) { console.error('[map] wheelchair init failed', err); return; }
  }
  if (!wheelchairApi) return;

  try {
    if (want) {
      const ids = routeCountryIds();
      await wheelchairApi.enable(ids.size ? ids : undefined);
      wheelchairOn = true;
    } else if (wheelchairOn) {
      wheelchairApi.disable();
      wheelchairOn = false;
    }
  } catch (err) {
    console.error('[map] wheelchair sync failed', err);
  }
  renderLayerToggles();
}

/**
 * State-driven green-hostels layer binding. Reads `filters.greenHostelsOnly`
 * and enables/disables the Leaflet layer. Also re-runs when `route` changes so
 * the city filter stays in sync with the user's stops.
 */
async function syncGreenHostelsFromState() {
  const map = getMap();
  if (!map) return;
  const want = !!(state.getSlice('filters') || {}).greenHostelsOnly;

  if (want && !greenHostelsApi) {
    try { greenHostelsApi = createGreenHostelsLayer(map); }
    catch (err) { console.error('[map] green hostels init failed', err); return; }
  }
  if (!greenHostelsApi) return;

  try {
    if (want) {
      const ids = routeCityIds();
      await greenHostelsApi.enable(ids.size ? ids : undefined);
      greenHostelsOn = true;
    } else if (greenHostelsOn) {
      greenHostelsApi.disable();
      greenHostelsOn = false;
    }
  } catch (err) {
    console.error('[map] green hostels sync failed', err);
  }
  renderLayerToggles();
}

export function unmount() {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'none';

  // Take the pickpocket layer off the map when leaving the page so it
  // doesn't stay visible over Guide / Prep pages (map container is hidden
  // but the layer still renders on re-entry otherwise).
  const map = getMap();
  if (map && pickpocketOn) {
    togglePickpocketLayer(map, false);
    pickpocketOn = false;
  }
  // Keep a11y.wheelchairLayer state intact across page navigation — just
  // detach the Leaflet layer so it isn't drawn while the map is hidden.
  // On re-mount, syncWheelchairFromState() restores it from state.
  if (wheelchairApi && wheelchairOn) {
    wheelchairApi.disable();
    wheelchairOn = false;
  }
  // Keep filters.greenHostelsOnly state intact across page navigation —
  // just detach the Leaflet layer so it isn't drawn while the map is hidden.
  if (greenHostelsApi && greenHostelsOn) {
    greenHostelsApi.disable();
    greenHostelsOn = false;
  }

  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  chipStripEl = null;
  layerControlsEl = null;
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

function renderLayerToggles() {
  if (!layerControlsEl) return;
  empty(layerControlsEl);
  const btn = h('button', {
    class: 'layer-toggle' + (pickpocketOn ? ' is-on' : ''),
    type: 'button',
    'aria-pressed': pickpocketOn ? 'true' : 'false',
    onclick: async () => {
      const map = getMap();
      if (!map) return;
      pickpocketOn = !pickpocketOn;
      try {
        await togglePickpocketLayer(map, pickpocketOn);
      } catch (err) {
        console.error('[map] pickpocket toggle failed', err);
        pickpocketOn = !pickpocketOn;
      }
      renderLayerToggles();
    }
  }, [
    h('span', { 'aria-hidden': 'true' }, '🛡'),
    h('span', null, t('pickpocket.layerToggle'))
  ]);
  layerControlsEl.appendChild(btn);

  // Wheelchair / step-free metro layer toggle. Shown always; when the
  // current route includes any city with wheelchair data the button is
  // visually promoted via .is-offered to surface the auto-offer per spec.
  const routeIds = routeCountryIds();
  const offered = routeIds.size > 0; // heuristic: any stops → offer
  const wcBtn = h('button', {
    class: 'layer-toggle'
      + (wheelchairOn ? ' is-on' : '')
      + (offered && !wheelchairOn ? ' is-offered' : ''),
    type: 'button',
    'aria-pressed': wheelchairOn ? 'true' : 'false',
    'aria-label': t('a11y.wheelchair.toggle'),
    title: t('a11y.wheelchair.description'),
    onclick: () => {
      // Write to state — subscribe in syncWheelchairFromState() drives the layer.
      const next = !wheelchairOn;
      state.update('a11y', a => ({ ...(a || {}), wheelchairLayer: next }));
    }
  }, [
    h('span', { 'aria-hidden': 'true' }, '\u267F'),
    h('span', null, t('a11y.wheelchair.toggle'))
  ]);
  layerControlsEl.appendChild(wcBtn);

  // Green-certified hostels layer toggle. Flips state.filters.greenHostelsOnly;
  // syncGreenHostelsFromState() handles the actual Leaflet layer attach.
  const ghBtn = h('button', {
    class: 'layer-toggle' + (greenHostelsOn ? ' is-on' : ''),
    type: 'button',
    'aria-pressed': greenHostelsOn ? 'true' : 'false',
    'aria-label': t('green.layer.toggle'),
    title: t('green.layer.toggle'),
    onclick: () => {
      const next = !greenHostelsOn;
      state.update('filters', f => ({ ...(f || {}), greenHostelsOnly: next }));
    }
  }, [
    h('span', { 'aria-hidden': 'true' }, '\uD83C\uDF31'),
    h('span', null, t('green.layer.toggle'))
  ]);
  layerControlsEl.appendChild(ghBtn);
}

function renderRouteSummary() {
  if (!overlayEl) return;
  const existing = overlayEl.querySelector('.route-summary-overlay');
  if (existing) existing.remove();

  const route = state.getSlice('route');
  if (!route?.stops?.length) return;

  const countries = new Set(route.stops.map(s => s.countryId));
  const totalNights = route.stops.reduce((sum, s) => sum + (s.nights || 0), 0);

  const card = h('div', { class: 'route-summary-overlay', onclick: () => {
    state.set('panelOpen', true);
    state.set('panelTab', 'route');
  }}, [
    h('div', { class: 'route-summary-stat' }, [
      h('strong', null, String(countries.size)),
      h('span', null, t('map.countries'))
    ]),
    h('div', { class: 'route-summary-stat' }, [
      h('strong', null, String(totalNights)),
      h('span', null, t('map.nights'))
    ]),
    h('div', { class: 'route-summary-stat return-badge' }, [
      '🏠 ',
      route.includeReturnInBudget ? t('route.return.sectionTitle') + ' ✓' : t('route.return.sectionTitle') + ' –'
    ])
  ]);
  overlayEl.insertBefore(card, overlayEl.firstChild);
}

function renderChipStrip() {
  if (!chipStripEl) return;
  empty(chipStripEl);

  const route = state.getSlice('route');
  if (!route?.stops?.length) return;

  route.stops.forEach((stop) => {
    const country = countryById(stop.countryId);
    if (!country) return;
    const chip = h('button', {
      class: 'stop-chip',
      type: 'button',
      onclick: () => {
        document.dispatchEvent(new CustomEvent('focusstop', { detail: { countryId: stop.countryId } }));
      }
    }, [
      h('span', { class: 'stop-chip-flag' }, country.flag || ''),
      h('span', { class: 'stop-chip-city' }, stop.cityId || country.name)
    ]);
    chipStripEl.appendChild(chip);
  });
}
