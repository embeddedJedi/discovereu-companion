// js/map/wheelchair-layer.js
// Leaflet layer showing step-free metro stations from
// data/wheelmap-metro-index.json. Built lazily: the JSON isn't fetched and
// markers aren't created until the first enable() call.
//
// Exports: createWheelchairLayer(map) → { layer, enable(countryIds?), disable(), isEnabled() }
//
// NOTE (state binding pending): the v1.5 a11y slice in js/state.js ships with
// keys { dyslexiaMode, lowBandwidth, reduceMotion, highContrast, fontScale,
// lineHeight, letterSpacing, colorBlindMode, transcribeVoice }. It does NOT
// yet have a `wheelchair` / `wheelchairLayer` boolean. Until that key is added
// (follow-up migration, schema bump + PERSIST_KEYS round-trip + a11y-panel
// wiring), callers toggle this layer imperatively via enable()/disable().
// When the key lands, subscribe inside createWheelchairLayer():
//   state.subscribe('a11y', (a) => a.wheelchairLayer ? api.enable() : api.disable());

/* global L */

import { loadJson } from '../data/loader.js';
import { t } from '../i18n/i18n.js';

const DATA_PATH = 'wheelmap-metro-index.json';

// Inline SVG wheelchair glyph — keeps the layer self-contained (no external
// asset, works offline, respects currentColor via CSS on the wrapper).
const WHEELCHAIR_ICON_HTML =
  '<span class="wheelchair-marker__glyph" aria-hidden="true">\u267F</span>';

function buildDivIcon() {
  return L.divIcon({
    className: 'wheelchair-marker',
    html: WHEELCHAIR_ICON_HTML,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function popupHtml(station, city) {
  const name = escapeHtml(station.name);
  const line = station.line != null ? escapeHtml(String(station.line)) : '';
  const lift = station.lift ? ' \u2713 lift' : '';
  const stepFree = station.stepFree ? ' \u2713 step-free' : '';
  const cityName = escapeHtml(city || '');
  const lineRow = line ? `<div class="wc-popup__line">Line ${line}</div>` : '';
  return (
    `<div class="wc-popup">`
    + `<strong class="wc-popup__name">${name}</strong>`
    + (cityName ? `<div class="wc-popup__city">${cityName}</div>` : '')
    + lineRow
    + `<div class="wc-popup__flags">${stepFree}${lift}</div>`
    + `</div>`
  );
}

/**
 * Build a Leaflet wheelchair-accessibility layer.
 *
 * @param {L.Map} map  Leaflet map instance
 * @returns {{
 *   layer: L.LayerGroup,
 *   enable: (countryIds?: Set<string>) => Promise<void>,
 *   disable: () => void,
 *   isEnabled: () => boolean
 * }}
 */
export function createWheelchairLayer(map) {
  if (!map) throw new Error('[wheelchair-layer] map is required');

  const layer = L.layerGroup();
  let data = null;            // cached JSON
  let built = false;          // markers added to layer at least once
  let enabled = false;
  let lastFilter = null;      // last Set<string> of countryIds used to build

  async function ensureData() {
    if (data) return data;
    try {
      data = await loadJson(DATA_PATH);
    } catch (err) {
      console.warn('[wheelchair-layer] data load failed', err);
      data = { cities: [] };
    }
    return data;
  }

  function buildMarkers(countryIds) {
    layer.clearLayers();
    if (!data || !Array.isArray(data.cities)) return;

    for (const city of data.cities) {
      if (countryIds && countryIds.size && !countryIds.has(city.country)) continue;
      const stations = Array.isArray(city.stations) ? city.stations : [];
      for (const st of stations) {
        // Skip silently for stations without coordinates — required by spec.
        if (st.lat == null || st.lon == null) continue;

        const marker = L.marker([st.lat, st.lon], {
          icon: buildDivIcon(),
          keyboard: true,
          alt: t('a11y.wheelchair.toggle') + ': ' + (st.name || ''),
          title: st.name || ''
        });

        const lineLabel = st.line != null ? ` Line ${st.line}` : '';
        const ariaLabel = `Accessible metro station: ${st.name || ''},${lineLabel}`;

        marker.on('add', () => {
          const el = marker.getElement();
          if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', ariaLabel.trim());
            el.setAttribute('tabindex', '0');
          }
        });

        marker.bindPopup(popupHtml(st, city.city));
        marker.addTo(layer);
      }
    }
    built = true;
    lastFilter = countryIds || null;
  }

  async function enable(countryIds) {
    await ensureData();
    // Rebuild only if filter changed or markers haven't been built yet.
    const filterChanged =
      (lastFilter && !countryIds)
      || (!lastFilter && countryIds && countryIds.size)
      || (lastFilter && countryIds && (
        lastFilter.size !== countryIds.size
        || [...countryIds].some(id => !lastFilter.has(id))
      ));
    if (!built || filterChanged) buildMarkers(countryIds);
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

  return { layer, enable, disable, isEnabled };
}
