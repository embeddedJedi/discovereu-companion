// js/map/labels.js
// Zoom-aware country labels. Labels are rendered as Leaflet tooltip markers
// positioned at each feature's visual centroid. They fade in/out based on
// the current map zoom and the country's "label tier" (population class).

/* global L */

import { loadEuropeGeoJson } from '../data/loader.js';
import { countryById } from '../state.js';

const labelLayer = L.layerGroup();
const labelMarkers = new Map();  // ISO-A2 → L.Marker

// Zoom thresholds: a label becomes visible at or above its tier's threshold.
// Tier is chosen per country by size (approx area / population).
const TIER_ZOOM = { 0: 3, 1: 4, 2: 5, 3: 6 };

/**
 * Add the label layer to the given map.
 *
 *   await initLabelsLayer(map);
 */
export async function initLabelsLayer(map) {
  if (labelMarkers.size > 0) {
    labelLayer.addTo(map);
    updateVisibility(map.getZoom());
    return labelLayer;
  }

  const geojson = await loadEuropeGeoJson();

  for (const feature of geojson.features || []) {
    const id = (feature.properties?.id || feature.properties?.ISO_A2 || '').toUpperCase();
    if (!id) continue;

    const center = featureCentroid(feature);
    if (!center) continue;

    const country = countryById(id);
    const name = country?.name || feature.properties?.name || id;
    const tier = labelTier(country);

    const marker = L.marker(center, {
      icon: L.divIcon({
        className: `country-label tier-${tier}`,
        html: escapeHtml(name),
        iconSize: null,  // let CSS size it
        iconAnchor: [0, 0]
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -100
    });

    marker._tier = tier;
    labelMarkers.set(id, marker);
    marker.addTo(labelLayer);
  }

  labelLayer.addTo(map);
  updateVisibility(map.getZoom());
  map.on('zoomend', () => updateVisibility(map.getZoom()));

  return labelLayer;
}

function updateVisibility(zoom) {
  labelMarkers.forEach(marker => {
    const threshold = TIER_ZOOM[marker._tier] ?? 4;
    const el = marker.getElement?.();
    if (!el) return;
    el.classList.toggle('hidden', zoom < threshold);
  });
}

// Pick a label importance tier from the country record.
// 0 = always visible (large / anchor countries)
// 1 = visible from zoom 4
// 2 = visible from zoom 5
// 3 = visible from zoom 6 only (tiny states)
function labelTier(country) {
  if (!country) return 2;
  const area = country.area_km2 || 0;
  if (area > 400_000) return 0;      // DE, FR, ES, SE, NO, TR
  if (area > 100_000) return 1;      // IT, PL, GR, FI, UK-sized
  if (area > 20_000)  return 2;      // BE, NL, CH, CZ, AT, HU
  return 3;                          // LU, MT, LI, micro-states
}

// Compute a simple visual centroid from a GeoJSON geometry.
// Works for Polygon and MultiPolygon; picks the largest ring for MultiPolygon.
function featureCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return null;

  let ring = null;
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    // Largest polygon by bounding-box area — good enough for label placement
    let best = null, bestSize = 0;
    for (const poly of geom.coordinates) {
      const r = poly[0];
      const size = ringExtent(r);
      if (size > bestSize) { best = r; bestSize = size; }
    }
    ring = best;
  }
  if (!ring || ring.length === 0) return null;

  let sx = 0, sy = 0, n = 0;
  for (const [x, y] of ring) { sx += x; sy += y; n++; }
  return [sy / n, sx / n];  // Leaflet wants [lat, lng]
}

function ringExtent(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
