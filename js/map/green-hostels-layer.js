// js/map/green-hostels-layer.js
// v1.7 — Leaflet layer for certified green hostels.
//
// Exports: createGreenHostelsLayer(map) → { layer, enable(cityIds?), disable(), isEnabled(), refresh() }
//
// Data source: data/green-hostels.json. Entries flagged with `verify: true`
// are placeholders and are SKIPPED at render time (never pinned on the map).
//
// State binding lives in the caller (js/pages/map.js or filters-ui.js) — the
// module itself is a pure imperative API so it can be reused in tests.
//
// DOM discipline: popup contents are built with the `h()` helper; no
// innerHTML interpolation of user/data strings.

/* global L */

import { loadJson } from '../data/loader.js';
import { t } from '../i18n/i18n.js';
import { h } from '../utils/dom.js';

const DATA_PATH = 'green-hostels.json';

// Inline leaf SVG (currentColor-tintable). Kept small to stay offline-friendly.
const LEAF_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
  + '<path fill="currentColor" d="M17 3c-6 0-11 4-11 11 0 2 1 4 2 5C5 18 4 15 4 12 4 7 9 3 17 3zm-1 2c-5 1-8 5-8 9 0 1 0 2 1 3 1-6 5-9 10-10-1-1-2-2-3-2z"/>'
  + '</svg>';

const MARKER_HTML = `<span class="green-hostel-marker__glyph" aria-hidden="true">${LEAF_SVG}</span>`;

// Map raw `cert` strings from data to i18n key slugs under `green.cert.*`.
function certSlug(cert) {
  const c = String(cert || '').toLowerCase();
  if (c.includes('ecolabel')) return 'ecolabel';
  if (c.includes('green key') || c.includes('greenkey')) return 'greenkey';
  if (c.includes('leed')) return 'leed';
  if (c.includes('nordic')) return 'nordicswan';
  if (c.includes('biosphere')) return 'biosphere';
  return null;
}

function certLabel(cert) {
  const slug = certSlug(cert);
  if (!slug) return String(cert || '');
  const key = `green.cert.${slug}`;
  const out = t(key);
  return out === key ? String(cert) : out;
}

function priceLabel(tier) {
  if (!tier) return '';
  const key = `green.priceTier.${tier}`;
  const out = t(key);
  return out === key ? String(tier) : out;
}

function buildDivIcon() {
  return L.divIcon({
    className: 'green-hostel-marker',
    html: MARKER_HTML,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function buildPopup(hostel) {
  const score = Math.max(0, Math.min(5, Number(hostel.sustainabilityScore) || 0));
  const stars = '\u2B50'.repeat(score);

  const children = [
    h('strong', { class: 'green-hostel-popup__name' }, hostel.name || '')
  ];

  const certText = certLabel(hostel.cert);
  if (certText) {
    children.push(h('div', { class: 'green-hostel-popup__cert' }, certText));
  }

  if (score > 0) {
    children.push(h('div', {
      class: 'green-hostel-popup__row',
      role: 'img',
      'aria-label': `${t('green.score.label')}: ${score}/5`
    }, stars));
  }

  const pLabel = priceLabel(hostel.priceTier);
  if (pLabel) {
    children.push(h('div', { class: 'green-hostel-popup__row' }, pLabel));
  }

  if (hostel.verifiedAt) {
    const key = 'green.popup.verified';
    const raw = t(key, { date: hostel.verifiedAt });
    const text = raw === key ? `Verified ${hostel.verifiedAt}` : raw;
    children.push(h('div', { class: 'green-hostel-popup__row' }, text));
  }

  if (hostel.url) {
    children.push(h('a', {
      class: 'green-hostel-popup__visit',
      href: hostel.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      referrerpolicy: 'no-referrer'
    }, t('green.popup.visit')));
  }

  return h('div', { class: 'green-hostel-popup' }, children);
}

/**
 * Build a Leaflet green-hostel overlay.
 *
 * @param {L.Map} map
 * @returns {{
 *   layer: L.LayerGroup,
 *   enable: (cityIds?: Set<string>) => Promise<void>,
 *   disable: () => void,
 *   isEnabled: () => boolean,
 *   refresh: () => Promise<void>
 * }}
 */
export function createGreenHostelsLayer(map) {
  if (!map) throw new Error('[green-hostels-layer] map is required');

  const layer = L.layerGroup();
  let data = null;
  let built = false;
  let enabled = false;
  let lastFilter = null;   // last Set<string> of cityIds used to build

  async function ensureData() {
    if (data) return data;
    try {
      data = await loadJson(DATA_PATH);
    } catch (err) {
      console.warn('[green-hostels-layer] data load failed', err);
      data = { hostels: [] };
    }
    return data;
  }

  function buildMarkers(cityIds) {
    layer.clearLayers();
    const hostels = Array.isArray(data?.hostels) ? data.hostels : [];

    for (const hostel of hostels) {
      // Skip unverified placeholder entries — spec requires no pins until confirmed.
      if (hostel.verify === true) continue;
      if (typeof hostel.lat !== 'number' || typeof hostel.lng !== 'number') continue;
      if (cityIds && cityIds.size && !cityIds.has(hostel.cityId)) continue;

      const marker = L.marker([hostel.lat, hostel.lng], {
        icon: buildDivIcon(),
        keyboard: true,
        alt: `${t('green.marker.popupTitle')}: ${hostel.name || ''}`,
        title: hostel.name || ''
      });

      const ariaLabel = `Green-certified hostel: ${hostel.name || ''}, ${certLabel(hostel.cert)}`;

      marker.on('add', () => {
        const el = marker.getElement();
        if (el) {
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', ariaLabel.trim());
          el.setAttribute('tabindex', '0');
        }
      });

      marker.bindPopup(() => buildPopup(hostel));
      marker.addTo(layer);
    }
    built = true;
    lastFilter = cityIds || null;
  }

  function filtersEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  }

  async function enable(cityIds) {
    await ensureData();
    const filter = cityIds && cityIds.size ? cityIds : null;
    if (!built || !filtersEqual(lastFilter, filter)) buildMarkers(filter);
    if (!map.hasLayer(layer)) layer.addTo(map);
    enabled = true;
  }

  function disable() {
    if (map.hasLayer(layer)) map.removeLayer(layer);
    enabled = false;
  }

  function isEnabled() {
    return enabled;
  }

  async function refresh() {
    // Force rebuild against the cached last filter.
    await ensureData();
    buildMarkers(lastFilter);
  }

  return { layer, enable, disable, isEnabled, refresh };
}
