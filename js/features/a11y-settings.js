// js/features/a11y-settings.js
// v1.5 Accessibility Overlay — applier + lazy OpenDyslexic loader + motion override chain.
//
// Responsibilities:
//  - Read state.a11y and write matching data-* attributes + CSS custom
//    properties on <html> (document.documentElement).
//  - Lazy-load the OpenDyslexic webfont the first time dyslexiaMode flips on.
//  - Honour the OS reduce-motion preference when the user has not explicitly
//    overridden it (state.a11y.reduceMotion === null).

import { state } from '../state.js';

const ROOT = document.documentElement;
const OPEN_DYSLEXIC_HREF = 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.0.4/index.css';

/**
 * Returns the current OS-level reduce-motion preference.
 * Safe against non-browser / test environments.
 */
export function detectReduceMotionOS() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Resolves the effective reduce-motion state.
 *   stateValue === null  → follow osValue
 *   stateValue === true  → always on
 *   stateValue === false → always off
 */
export function resolveMotionSetting(stateValue, osValue) {
  if (stateValue === null || stateValue === undefined) return osValue === true;
  return stateValue === true;
}

/**
 * Lazy-load OpenDyslexic from a CDN. Memoised — subsequent calls return the
 * same promise. Rejects after 10s if the stylesheet never loads.
 */
export async function loadDyslexiaFont() {
  if (loadDyslexiaFont._p) return loadDyslexiaFont._p;
  loadDyslexiaFont._p = (async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = OPEN_DYSLEXIC_HREF;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn) => (arg) => { if (settled) return; settled = true; fn(arg); };
      link.addEventListener('load',  done(resolve), { once: true });
      link.addEventListener('error', done(reject),  { once: true });
      setTimeout(done(reject), 10_000, new Error('OpenDyslexic load timeout'));
    });
  })().catch((err) => {
    // Clear memoised rejection so user can retry later (e.g. network came back).
    loadDyslexiaFont._p = null;
    throw err;
  });
  return loadDyslexiaFont._p;
}

/**
 * Pure-ish applier: writes a11y settings to document.documentElement.
 * Takes the full a11y slice shape from state.
 */
export function applyA11ySettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  if (!ROOT) return;

  // Booleans → data-* on/off (attribute removed when off to keep DOM clean).
  setFlagAttr('data-a11y-dyslexia', settings.dyslexiaMode === true, 'on');
  setFlagAttr('data-a11y-contrast', settings.highContrast === true, 'on');
  setFlagAttr('data-a11y-lowbw',    settings.lowBandwidth === true, 'on');

  // Motion override chain.
  const osReduce = detectReduceMotionOS();
  const motionOn = resolveMotionSetting(settings.reduceMotion, osReduce);
  setFlagAttr('data-a11y-motion', motionOn, 'none');

  // Color blind mode — attribute only present when not 'none'.
  const cb = settings.colorBlindMode;
  if (cb && cb !== 'none') {
    ROOT.setAttribute('data-a11y-colorblind', String(cb));
  } else {
    ROOT.removeAttribute('data-a11y-colorblind');
  }

  // Numeric CSS custom properties.
  if (typeof settings.fontScale === 'number') {
    ROOT.style.setProperty('--a11y-font-scale', String(settings.fontScale));
  }
  if (typeof settings.lineHeight === 'number') {
    ROOT.style.setProperty('--a11y-line-height', String(settings.lineHeight));
  }
  if (typeof settings.letterSpacing === 'number') {
    ROOT.style.setProperty('--a11y-letter-spacing', `${settings.letterSpacing}em`);
  }

  // Trigger lazy font load the first time dyslexiaMode becomes true.
  if (settings.dyslexiaMode === true) {
    loadDyslexiaFont().catch((err) => {
      console.warn('[a11y] OpenDyslexic font failed to load', err);
    });
  }
}

function setFlagAttr(attr, on, value) {
  if (on) ROOT.setAttribute(attr, value);
  else ROOT.removeAttribute(attr);
}

let _inited = false;

/**
 * Wire up subscriptions. Call once at boot after state hydration.
 * Applies current settings immediately, on state.a11y change, and on
 * OS prefers-reduced-motion change (when user hasn't overridden it).
 */
export function initA11y() {
  if (_inited) return;
  _inited = true;

  // Initial apply.
  applyA11ySettings(state.getSlice('a11y'));

  // React to state changes.
  state.subscribe('a11y', (next) => applyA11ySettings(next));

  // React to OS reduce-motion changes — only matters when user setting is null.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = () => {
        const current = state.getSlice('a11y');
        if (current && current.reduceMotion === null) {
          applyA11ySettings(current);
        }
      };
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handler);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(handler); // Safari legacy
      }
    } catch (err) {
      console.warn('[a11y] matchMedia subscription failed', err);
    }
  }
}
