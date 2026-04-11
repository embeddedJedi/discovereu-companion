// js/map/inclusion-layer.js
// Recolours country polygons in the existing Leaflet layer based on
// state.inclusionMode. Sibling to countries-layer.js: stroke/class state
// stays untouched, we only update fillColor + fillOpacity through
// Leaflet's setStyle(). CSS custom properties are read from the computed
// style of :root so gradients respect dark/light theme.

import { state } from '../state.js';
import { ensureInclusionData, inclusionLayerValue } from '../features/inclusion-data.js';

const GRADIENT_STOPS = [
  { pct: 0,   varName: '--inclusion-grad-0'   },
  { pct: 25,  varName: '--inclusion-grad-25'  },
  { pct: 50,  varName: '--inclusion-grad-50'  },
  { pct: 75,  varName: '--inclusion-grad-75'  },
  { pct: 100, varName: '--inclusion-grad-100' }
];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function gradientColorForPct(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Pick the nearest stop under and over; return the lower stop's colour
  // (step gradient, not interpolated — keeps it deterministic and fast).
  for (let i = GRADIENT_STOPS.length - 1; i >= 0; i--) {
    if (clamped >= GRADIENT_STOPS[i].pct) return cssVar(GRADIENT_STOPS[i].varName);
  }
  return cssVar(GRADIENT_STOPS[0].varName);
}

/**
 * Apply the current inclusionMode to the given Leaflet GeoJSON layer.
 * layer is the returned layer from initCountriesLayer().
 */
export async function initInclusionLayer(layer) {
  await ensureInclusionData();  // one-shot load; synchronous on repeat

  const apply = () => {
    const mode = state.getSlice('inclusionMode');
    layer.eachLayer(sub => {
      const id = sub.feature?.properties?.id;
      if (!id) return;
      if (mode === 'default') {
        sub.setStyle({ fillColor: 'transparent', fillOpacity: 0 });
        return;
      }
      const value = inclusionLayerValue(id, mode);
      if (value == null) {
        sub.setStyle({ fillColor: 'transparent', fillOpacity: 0 });
        return;
      }
      sub.setStyle({
        fillColor: gradientColorForPct(value * 100),
        fillOpacity: 0.55
      });
    });
  };

  state.subscribe('inclusionMode', apply);
  state.subscribe('countries', apply);   // re-apply if dataset reloads
  document.addEventListener('themechange', apply);  // gradients change with theme
  apply();
}
