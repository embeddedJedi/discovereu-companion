// js/pages/map.js
// Map page: full-screen Leaflet map + overlay elements + bottom sheet.
// The map is persistent (lives in #mapContainer, not destroyed on page switch).
// mount() shows it + adds overlays, unmount() hides it + cleans up.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, qs, empty } from '../utils/dom.js';
import { createBottomSheet } from '../ui/bottom-sheet.js';
import { navigate } from '../router.js';

let sheet = null;
let overlayEl = null;
let chipStripEl = null;
let unsubscribers = [];

export function mount(container) {
  // Show the map container
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'block';

  // Create overlay elements
  overlayEl = h('div', { class: 'map-overlays' });
  container.appendChild(overlayEl);

  // Route summary card (top-left)
  renderRouteSummary();

  // Stop chip strip (bottom-left)
  chipStripEl = h('div', { class: 'chip-strip' });
  overlayEl.appendChild(chipStripEl);
  renderChipStrip();

  // Bottom sheet for country detail
  sheet = createBottomSheet();
  container.appendChild(sheet.el);

  // Subscribe to state changes
  unsubscribers.push(
    state.subscribe('route', () => { renderRouteSummary(); renderChipStrip(); }),
    state.subscribe('selectedCountry', onCountrySelected),
    state.subscribe('language', () => { renderRouteSummary(); renderChipStrip(); })
  );

  // Listen for country-click events from countries-layer
  document.addEventListener('countryclick', onCountryClick);
}

export function unmount() {
  const mapContainer = qs('#mapContainer');
  if (mapContainer) mapContainer.style.display = 'none';

  if (sheet) { sheet.destroy(); sheet = null; }
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  chipStripEl = null;
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  document.removeEventListener('countryclick', onCountryClick);
}

function onCountryClick(ev) {
  const { countryId } = ev.detail;
  state.set('selectedCountry', countryId);
}

function onCountrySelected(countryId) {
  if (!countryId || !sheet) return;
  const country = countryById(countryId);
  if (!country) return;
  const content = renderCountrySheet(country);
  sheet.open(content, 'peek');
}

function renderCountrySheet(country) {
  return h('div', { class: 'country-sheet' }, [
    h('div', { class: 'country-sheet-header' }, [
      h('span', { class: 'country-sheet-flag', 'aria-hidden': 'true' }, country.flag || ''),
      h('h2', { class: 'country-sheet-name' }, country.name),
      country.nonParticipating
        ? h('span', { class: 'badge badge-warning' }, t('country.nonParticipating'))
        : null
    ]),
    h('div', { class: 'country-sheet-scores' },
      ['nature', 'culture', 'nightlife', 'food', 'safety'].map(key =>
        h('div', { class: 'score-chip' }, [
          h('span', { class: 'score-chip-label' }, t(`score.${key}`)),
          h('span', { class: 'score-chip-value' }, String(country.scores?.[key] ?? '–'))
        ])
      )
    ),
    h('div', { class: 'country-sheet-actions' }, [
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => {
          state.update('route', r => ({
            ...r,
            stops: [...r.stops, { countryId: country.id, cityId: null, nights: 2, arrivalDay: null }]
          }));
          sheet.close();
        }
      }, t('country.addToRoute')),
      h('button', {
        class: 'btn btn-secondary',
        type: 'button',
        onclick: () => {
          sheet.close();
          navigate('guide', country.id);
        }
      }, t('country.viewGuide'))
    ])
  ]);
}

function renderRouteSummary() {
  if (!overlayEl) return;
  const existing = overlayEl.querySelector('.route-summary-overlay');
  if (existing) existing.remove();

  const route = state.getSlice('route');
  if (!route?.stops?.length) return;

  const countries = new Set(route.stops.map(s => s.countryId));
  const totalNights = route.stops.reduce((sum, s) => sum + (s.nights || 0), 0);

  const card = h('div', { class: 'route-summary-overlay', onclick: () => navigate('plan') }, [
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
