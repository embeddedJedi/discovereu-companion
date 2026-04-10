// js/ui/theme.js
// Dark / light / system theme toggle with system preference detection.
// Persists via state (which persists to localStorage).

import { state } from '../state.js';
import { qs } from '../utils/dom.js';

const THEME_EVENT = 'themechange';

function getSystemTheme() {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

export function initTheme() {
  // Hydrate from state (already loaded from storage at Store init)
  let saved = state.getSlice('theme');
  if (!saved) {
    saved = getSystemTheme();
    state.set('theme', saved);
  }
  applyTheme(saved);

  // Subscribe to future changes
  state.subscribe('theme', applyTheme);

  // System preference change listener (if user hasn't manually chosen)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (ev) => {
    // Only follow system if we're tracking it; for MVP we don't distinguish
    // a manual override vs. system, so leave this as is and let the user toggle.
  });

  // Wire the toggle button
  const btn = qs('#btnTheme');
  if (btn) {
    btn.addEventListener('click', toggle);
  }
}

export function toggle() {
  const current = state.getSlice('theme');
  state.set('theme', current === 'dark' ? 'light' : 'dark');
}

export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  state.set('theme', theme);
}

export function onThemeChange(callback) {
  const handler = (ev) => callback(ev.detail.theme);
  document.addEventListener(THEME_EVENT, handler);
  return () => document.removeEventListener(THEME_EVENT, handler);
}
