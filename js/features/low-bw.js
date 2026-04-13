// js/features/low-bw.js
// v1.5 Accessibility Overlay — bandwidth-aware module gate.
//
// Purpose
// -------
// Central switchboard that other feature modules consult before doing
// expensive work (canvas rendering, map tile fetches, mic permission
// prompts, chart drawing). When state.a11y.lowBandwidth === true the
// gate returns `true` and callers should substitute a lean placeholder
// instead of running the heavy code path.
//
// The CSS side of the mode is handled by css/a11y-lowbw.css (hides
// decorative imagery under html[data-a11y-lowbw="on"]). The data-*
// attribute itself is set by js/features/a11y-settings.js; this module
// intentionally does NOT touch <html> so the applier remains the single
// writer.
//
// Integration pattern
// -------------------
//   import { shouldDefer } from './low-bw.js';
//   export function render() {
//     if (shouldDefer('my-module')) {
//       renderPlaceholder();
//       return;
//     }
//     renderHeavyThing();
//   }
//
// Known module names (extend as new heavy features land):
//   'wrapped'        — canvas-heavy story/post cards
//   'voice-memory'   — MediaRecorder mic capture
//   'map-tiles'      — Leaflet raster tile layer (GeoJSON polygons stay)
//   'wrapped-charts' — Chart.js heavy visualisations inside Wrapped
//                      (compare + radar charts remain essential)
//
// API
// ---
//   initLowBw()               — app-boot subscription; keeps prefetch
//                               hints in sync with current flag.
//   isLowBw() -> boolean      — live read of state.a11y.lowBandwidth.
//   shouldDefer(name) -> bool — gate for feature modules.

import { state } from '../state.js';

// Set of module names that are deferred when low-bandwidth is on.
// Kept as a Set so we can answer shouldDefer() in O(1) and the list is
// discoverable via listDeferredModules().
const DEFERRED = new Set([
  'wrapped',
  'voice-memory',
  'map-tiles',
  'wrapped-charts'
]);

let initialized = false;
let unsubscribe = null;

/** Current low-bandwidth flag (persisted via state.a11y). */
export function isLowBw() {
  const a = state.getSlice('a11y');
  return !!(a && a.lowBandwidth);
}

/**
 * Should the named feature module defer its heavy work?
 * Unknown module names always return false — we never silently defer
 * something the caller did not opt into.
 */
export function shouldDefer(moduleName) {
  if (!DEFERRED.has(moduleName)) return false;
  return isLowBw();
}

/** Enumerate the module names the gate knows about. */
export function listDeferredModules() {
  return Array.from(DEFERRED);
}

/**
 * App-boot entry point. Idempotent.
 * - Subscribes to the a11y slice so we can strip prefetch hints when
 *   the user flips low-bw on, and restore nothing (prefetch hints are
 *   static, so we simply don't re-inject).
 * - Does NOT toggle the <html data-a11y-lowbw> attribute — that is the
 *   a11y-settings applier's job (single writer rule).
 */
export function initLowBw() {
  if (initialized) return;
  initialized = true;

  applyPrefetchPolicy(isLowBw());

  unsubscribe = state.subscribe('a11y', (slice) => {
    applyPrefetchPolicy(!!(slice && slice.lowBandwidth));
  });
}

/**
 * Remove <link rel="prefetch"> hints when low-bw is on. Safe no-op
 * when there are none in the current index.html.
 */
function applyPrefetchPolicy(on) {
  if (!on) return;
  if (typeof document === 'undefined') return;
  const hints = document.querySelectorAll('link[rel="prefetch"]');
  hints.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
}

/** Test hook — tear down the subscription. */
export function destroyLowBw() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  initialized = false;
}
