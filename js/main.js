// js/main.js
// Application bootstrap — wires state, i18n, theme, panel, map.
// Kept deliberately lean: everything interesting lives in its own module.

import { state } from './state.js';
import { i18n } from './i18n/i18n.js';
import { initTheme } from './ui/theme.js';
import { qs, on } from './utils/dom.js';

async function boot() {
  try {
    // 1. Theme — apply immediately (synchronous; prevents FOUC)
    initTheme();

    // 2. i18n — await language load before rendering UI strings
    const savedLang = state.getSlice('language') || 'en';
    await i18n.load(savedLang);

    // 3. Wire language switcher
    const langSelect = qs('#langSelect');
    if (langSelect) {
      langSelect.value = savedLang;
      langSelect.addEventListener('change', async (ev) => {
        await i18n.load(ev.target.value);
      });
    }

    // 4. Wire panel tabs
    initPanelTabs();

    // 5. Wire mobile bottom nav
    initBottomNav();

    // 6. Dynamic modules — loaded lazily so the shell appears fast
    await import('./map/map.js').then(m => m.initMap()).catch(err => {
      console.error('[main] map init failed', err);
    });

    // 7. Hide loading shell
    const loader = qs('#appLoading');
    if (loader) {
      loader.setAttribute('data-hidden', 'true');
      setTimeout(() => loader.remove(), 400);
    }

    console.info('[DiscoverEU Companion] ready');
  } catch (err) {
    console.error('[main] boot failed', err);
    const loader = qs('#appLoading');
    if (loader) loader.innerHTML = '<p style="color: var(--danger)">Failed to load app. Check console.</p>';
  }
}

function initPanelTabs() {
  const tabs = qs('.panel-tabs');
  if (!tabs) return;

  on(tabs, 'click', '.panel-tab', (_ev, target) => {
    const tab = target.dataset.tab;
    if (!tab) return;
    // Update tab state
    tabs.querySelectorAll('.panel-tab').forEach(t => {
      t.setAttribute('aria-selected', t === target ? 'true' : 'false');
    });
    state.set('panelTab', tab);
  });
}

function initBottomNav() {
  const nav = qs('.bottom-nav');
  if (!nav) return;

  on(nav, 'click', '.bottom-nav-item', (_ev, target) => {
    const tab = target.dataset.tab;
    if (!tab) return;
    nav.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.setAttribute('aria-selected', item === target ? 'true' : 'false');
    });
    // Open the side panel if closed
    const panel = qs('#sidePanel');
    if (panel) panel.setAttribute('data-open', 'true');
    state.set('panelTab', tab);
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
