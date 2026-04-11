// js/main.js
// Application bootstrap — wires state, i18n, theme, panel, map, data.
// Kept deliberately lean: everything interesting lives in its own module.

import { state } from './state.js';
import { i18n } from './i18n/i18n.js';
import { initTheme } from './ui/theme.js';
import { qs, on, setOpen } from './utils/dom.js';
import { loadCoreData } from './data/loader.js';
import { hydrateRouteFromHash, copyCurrentURL } from './utils/share.js';
import { showToast } from './ui/toast.js';
import { t } from './i18n/i18n.js';
import { initWrappedTrigger } from './features/wrapped.js';

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

    // 4. Wire panel tabs + mobile bottom nav + panel open/close reaction
    initPanelTabs();
    initBottomNav();
    initPanelOpenState();

    // 5. Core data bundle — countries / trains / reservations / templates
    //    Fire-and-await: we want the map layer to see the countries slice.
    await loadCoreData();

    // 5a. Shareable URL — hydrate the route slice from location.hash
    //     *after* countries load so the UI has names to render.
    hydrateRouteFromHash();

    // 5b. Wire the header share button
    const shareBtn = qs('#btnShare');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const route = state.getSlice('route');
        if (!route?.stops?.length) {
          showToast(t('share.empty'), 'warning');
          return;
        }
        const ok = await copyCurrentURL();
        showToast(ok ? t('share.copied') : t('share.failed'), ok ? 'success' : 'danger');
      });
    }

    // 6. Side-panel tab modules — each owns its own tab and subscribes to
    //    panelTab, re-rendering #panelBody when its tab becomes active.
    await Promise.all([
      import('./ui/country-detail.js').then(m => m.initCountryDetail()),
      import('./ui/filters-ui.js').then(m => m.initFiltersUI()),
      import('./ui/route-builder.js').then(m => m.initRouteBuilder()),
      import('./ui/budget.js').then(m => m.initBudget()),
      import('./ui/compare.js').then(m => m.initCompare()),
      import('./ui/inclusion.js').then(m => m.initInclusion()),
      import('./ui/prep.js').then(m => m.initPrep())
    ]);

    // 7. Map — init base, then layer polygons + labels on top
    const { initMap } = await import('./map/map.js');
    const map = initMap();

    if (map) {
      const [{ initCountriesLayer }, { initLabelsLayer }, { initInclusionLayer }] = await Promise.all([
        import('./map/countries-layer.js'),
        import('./map/labels.js'),
        import('./map/inclusion-layer.js')
      ]);
      const countriesLayer = await initCountriesLayer(map);
      await initLabelsLayer(map);
      if (countriesLayer) await initInclusionLayer(countriesLayer);
      // Reveal the legend now that polygons are drawn
      const legend = qs('#mapLegend');
      if (legend) legend.hidden = false;
    }

    // 7a. Register the service worker (PWA offline support). Non-blocking:
    //     failure logs a warning but the app keeps running online-only.
    registerServiceWorker();

    // 7b. Wire Wrapped card trigger (delegates to any [data-wrapped-trigger])
    initWrappedTrigger();

    // 8. Hide loading shell
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

function initPanelOpenState() {
  const panel = qs('#sidePanel');
  if (!panel) return;

  // Keep panel DOM + state in sync
  state.subscribe('panelOpen', (open) => setOpen(panel, open));
  setOpen(panel, state.getSlice('panelOpen') === true);

  // Auto-open the panel and jump to the Detail tab when a country is picked.
  state.subscribe('selectedCountry', (id) => {
    if (!id) return;
    state.set('panelOpen', true);
    state.set('panelTab', 'detail');
  });
}

function initPanelTabs() {
  const tabs = qs('.panel-tabs');
  if (!tabs) return;

  // Click → state
  on(tabs, 'click', '.panel-tab', (_ev, target) => {
    const tab = target.dataset.tab;
    if (tab) state.set('panelTab', tab);
  });

  // State → DOM (single source of truth)
  const sync = (tab) => {
    tabs.querySelectorAll('.panel-tab').forEach(t => {
      t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
    });
  };
  state.subscribe('panelTab', sync);
  sync(state.getSlice('panelTab') || 'detail');
}

function initBottomNav() {
  const nav = qs('.bottom-nav');
  if (!nav) return;

  on(nav, 'click', '.bottom-nav-item', (_ev, target) => {
    const tab = target.dataset.tab;
    if (!tab) return;
    state.set('panelOpen', true);
    state.set('panelTab', tab);
  });

  state.subscribe('panelTab', (tab) => {
    nav.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.setAttribute('aria-selected', item.dataset.tab === tab ? 'true' : 'false');
    });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Only register when served over HTTP(S); file:// cannot host a SW.
  if (!location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('[sw] registration failed', err);
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
