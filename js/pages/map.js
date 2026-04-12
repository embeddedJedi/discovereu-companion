// js/pages/map.js
// Map page: full-screen Leaflet map + overlay elements.
// Country detail is handled by the side panel (wired in main.js).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, qs, empty } from '../utils/dom.js';
import { getMap } from '../map/map.js';
import { initRouteLayer } from '../map/route-layer.js';
import { toggleLayer as togglePickpocketLayer } from '../features/pickpocket.js';

let overlayEl = null;
let chipStripEl = null;
let layerControlsEl = null;
let pickpocketOn = false;
let unsubscribers = [];

export function mount(container) {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'block';

  // Initialize route rendering layer (idempotent — guarded inside the module).
  const map = getMap();
  if (map) initRouteLayer(map);

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

  unsubscribers.push(
    state.subscribe('route', () => { renderRouteSummary(); renderChipStrip(); }),
    state.subscribe('language', () => { renderRouteSummary(); renderChipStrip(); renderLayerToggles(); })
  );
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
