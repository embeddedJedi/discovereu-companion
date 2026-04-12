// js/features/pickpocket.js
// Pickpocket Heatmap feature — city-level risk data.
// Awareness tool, not alarmism. Scores reflect opportunistic theft density
// relative to tourist volume; they are not a measure of overall safety or
// anything about residents of a city.
//
// Exports:
//   loadData()                          → async, cached
//   getZone(cityId)                     → entry or null
//   addLayer(map) / removeLayer(map)    → Leaflet layer group
//   toggleLayer(map, on)                → convenience wrapper
//   renderSafetyCallout(cityId, container) → DOM card for guide pages

/* global L */

import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

const DATA_URL = 'data/pickpocket-zones.json';

let cache = null;
let loadPromise = null;
let activeLayer = null;   // Leaflet LayerGroup when visible

/** Load and cache the JSON. Idempotent. */
export async function loadData() {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error(`pickpocket-zones: HTTP ${r.status}`);
      return r.json();
    })
    .then(json => { cache = json; return json; })
    .catch(err => {
      loadPromise = null;
      console.error('[pickpocket] loadData failed', err);
      throw err;
    });
  return loadPromise;
}

/** Get a single city entry (null if missing or not loaded). */
export function getZone(cityId) {
  if (!cache || !cityId) return null;
  return cache.cities?.[cityId] || null;
}

/** Pick a colour from a risk score 1–5. */
function colourFor(score) {
  if (score >= 4) return '#ef4444';   // red
  if (score === 3) return '#eab308';  // amber
  return '#22c55e';                   // green (1–2)
}

/** Map riskScore to an i18n label key. */
function riskLabelKey(score) {
  if (score >= 4) return 'pickpocket.riskHigh';
  if (score === 3) return 'pickpocket.riskMedium';
  return 'pickpocket.riskLow';
}

/** Escape a string for safe inclusion in innerHTML contexts. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Add the heatmap layer to the given Leaflet map.
 * Idempotent — calling twice leaves one layer.
 */
export async function addLayer(map) {
  if (!map || typeof L === 'undefined') return null;
  if (activeLayer) return activeLayer;
  const data = await loadData();
  const group = L.layerGroup();

  Object.values(data.cities || {}).forEach(zone => {
    if (typeof zone.lat !== 'number' || typeof zone.lng !== 'number') return;
    const color = colourFor(zone.riskScore);
    const circle = L.circle([zone.lat, zone.lng], {
      radius: 12000 + zone.riskScore * 2500,  // 14.5–24.5 km
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.35,
      className: 'pickpocket-zone'
    });

    const hotspots = Array.isArray(zone.hotspots) ? zone.hotspots : [];
    const tips = Array.isArray(zone.tips) ? zone.tips : [];
    const name = zone.cityId
      ? zone.cityId.charAt(0).toUpperCase() + zone.cityId.slice(1)
      : '';

    const popup = `
      <div class="pickpocket-popup">
        <div class="pickpocket-popup-head">
          <strong>${esc(name)}</strong>
          <span class="pickpocket-risk-pill" style="background:${color}">
            ${esc(t(riskLabelKey(zone.riskScore)))} · ${zone.riskScore}/5
          </span>
        </div>
        ${hotspots.length ? `
          <div class="pickpocket-popup-sect">
            <em>${esc(t('pickpocket.hotspots'))}</em>
            <ul>${hotspots.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>` : ''}
        ${tips.length ? `
          <div class="pickpocket-popup-sect">
            <em>${esc(t('pickpocket.tips'))}</em>
            <ul>${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>` : ''}
        <div class="pickpocket-popup-note">${esc(t('pickpocket.awarenessNote'))}</div>
      </div>`;
    circle.bindPopup(popup, { maxWidth: 320 });
    circle.bindTooltip(`${esc(name)} · ${zone.riskScore}/5`, { direction: 'top', opacity: 0.9 });
    group.addLayer(circle);
  });

  group.addTo(map);
  activeLayer = group;
  return group;
}

/** Remove the heatmap layer. Safe to call when not present. */
export function removeLayer(map) {
  if (!map || !activeLayer) return;
  map.removeLayer(activeLayer);
  activeLayer = null;
}

/** Toggle helper. */
export async function toggleLayer(map, on) {
  if (on) return addLayer(map);
  removeLayer(map);
  return null;
}

/**
 * Render an inline safety callout card into a container (used by the
 * country/city guide). Appends; does not clear container.
 * If no data exists for the city, renders a generic awareness card.
 */
export async function renderSafetyCallout(cityId, container) {
  if (!container) return;
  try { await loadData(); } catch { /* fall through with cache=null */ }
  const zone = getZone(cityId);
  const card = h('div', { class: 'pickpocket-callout' });

  // Header
  const score = zone?.riskScore;
  const pillColor = score ? colourFor(score) : 'var(--border-default)';
  const pillText = score
    ? `${t(riskLabelKey(score))} · ${score}/5`
    : t('pickpocket.noData');
  card.appendChild(h('div', { class: 'pickpocket-callout-head' }, [
    h('h4', null, `🛡 ${t('pickpocket.safetyCallout')}`),
    h('span', { class: 'pickpocket-risk-pill', style: { background: pillColor } }, pillText)
  ]));

  if (zone) {
    if (Array.isArray(zone.hotspots) && zone.hotspots.length) {
      card.appendChild(h('div', { class: 'pickpocket-callout-sect' }, [
        h('h5', null, t('pickpocket.hotspots')),
        h('ul', null, zone.hotspots.map(x => h('li', null, x)))
      ]));
    }
    if (Array.isArray(zone.tips) && zone.tips.length) {
      card.appendChild(h('div', { class: 'pickpocket-callout-sect' }, [
        h('h5', null, t('pickpocket.tips')),
        h('ul', null, zone.tips.map(x => h('li', null, x)))
      ]));
    }
    if (zone.note) {
      card.appendChild(h('p', { class: 'pickpocket-callout-note' }, zone.note));
    }
  } else {
    card.appendChild(h('p', { class: 'pickpocket-callout-note' }, t('pickpocket.noData')));
  }

  // Methodology + source footer
  const footer = h('footer', { class: 'pickpocket-callout-footer' }, [
    h('small', null, `${t('pickpocket.methodology')} · `),
    h('a', {
      href: 'https://github.com/embeddedJedi/discovereu-companion/blob/main/data/pickpocket-zones.json',
      target: '_blank',
      rel: 'noopener'
    }, t('pickpocket.source'))
  ]);
  card.appendChild(footer);

  container.appendChild(card);
}
