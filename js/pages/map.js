// js/pages/map.js
// Map page: full-screen Leaflet map + overlay elements.
// Country detail is handled by the side panel (wired in main.js).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, qs, empty } from '../utils/dom.js';

let overlayEl = null;
let chipStripEl = null;
let unsubscribers = [];

export function mount(container) {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'block';

  overlayEl = h('div', { class: 'map-overlays' });
  container.appendChild(overlayEl);

  renderRouteSummary();

  chipStripEl = h('div', { class: 'chip-strip' });
  overlayEl.appendChild(chipStripEl);
  renderChipStrip();

  unsubscribers.push(
    state.subscribe('route', () => { renderRouteSummary(); renderChipStrip(); }),
    state.subscribe('language', () => { renderRouteSummary(); renderChipStrip(); })
  );
}

export function unmount() {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'none';

  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  chipStripEl = null;
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
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
