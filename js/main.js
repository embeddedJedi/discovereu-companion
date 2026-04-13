// js/main.js — v1.1 hybrid
// Map page + side panel (5 tabs) + 2 standalone pages.

import { state } from './state.js';
import { i18n, t } from './i18n/i18n.js';
import { initTheme } from './ui/theme.js';
import { qs, on, setOpen } from './utils/dom.js';
import { loadCoreData } from './data/loader.js';
import { hydrateRouteFromHash } from './utils/share.js';
import { showToast } from './ui/toast.js';
import { parseHash, onRouteChange } from './router.js';
import { initBottomNav } from './ui/bottom-nav.js';
import { initA11y } from './features/a11y-settings.js';
import { initLowBw } from './features/low-bw.js';

const pageCache = {};
const PAGE_MODULES = {
  map:      () => import('./pages/map.js'),
  rehber:   () => import('./pages/rehber.js'),
  kesfet:   () => import('./pages/kesfet.js'),
  hazirlik: () => import('./pages/hazirlik.js'),
  impact:   () => import('./pages/impact.js')
};

let currentPageModule = null;
let currentPageName = null;

async function boot() {
  try {
    // 1. Theme
    initTheme();

    // 2. i18n
    const savedLang = state.getSlice('language') || 'en';
    await i18n.load(savedLang);

    // 2b. Accessibility overlay — apply persisted a11y settings before first render.
    initA11y();
    initLowBw();

    // 3. Wire language switcher
    const langSelect = qs('#langSelect');
    if (langSelect) {
      langSelect.value = savedLang;
      langSelect.addEventListener('change', async (ev) => {
        await i18n.load(ev.target.value);
      });
    }

    // 4. Core data
    await loadCoreData();

    // 5. Share URL hydration
    if (location.hash.startsWith('#route=')) {
      hydrateRouteFromHash();
    }

    // 6. Init map (persistent)
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
      const legend = qs('#mapLegend');
      if (legend) legend.hidden = false;
    }

    // 7. Wire side panel tabs (map page — 5 tabs)
    initPanelTabs();
    initPanelOpenState();

    // 8. Init side-panel tab modules (they subscribe to state.panelTab)
    await Promise.all([
      import('./ui/country-detail.js').then(m => m.initCountryDetail()),
      import('./ui/filters-ui.js').then(m => m.initFiltersUI()),
      import('./ui/route-builder.js').then(m => m.initRouteBuilder()),
      import('./ui/budget.js').then(m => m.initBudget()),
      import('./ui/compare.js').then(m => m.initCompare()),
    ]);

    // 9. Bottom navigation (3 items)
    const navRoot = qs('#bottomNavRoot');
    if (navRoot) initBottomNav(navRoot);

    // 10. Router
    const pageRoot = qs('#pageRoot');
    onRouteChange((route) => mountPage(route.page, pageRoot));
    const initial = parseHash();
    await mountPage(initial.page, pageRoot);

    // 11. Wire header buttons
    wireHeaderButtons();

    // 12. Service worker
    registerServiceWorker();

    // 13. Hide loading shell
    const loader = qs('#appLoading');
    if (loader) {
      loader.setAttribute('data-hidden', 'true');
      setTimeout(() => loader.remove(), 400);
    }

    // 14. Welcome wizard
    const { shouldShowWizard, openWizard } = await import('./ui/welcome-wizard.js');
    if (shouldShowWizard()) {
      setTimeout(openWizard, 500);
    }
    const settingsBtn = qs('#btnSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => openWizard());
    }

    // 15. Wrapped trigger
    const { initWrappedTrigger } = await import('./features/wrapped.js');
    initWrappedTrigger();

    console.info('[DiscoverEU Companion v1.1] ready');
  } catch (err) {
    console.error('[main] boot failed', err);
    const loader = qs('#appLoading');
    if (loader) loader.innerHTML = '<p style="color: var(--danger)">Failed to load app. Check console.</p>';
  }
}

// ─── Side panel (map page) ──────────────────────────────────────────

function initPanelOpenState() {
  const panel = qs('#sidePanel');
  if (!panel) return;

  state.subscribe('panelOpen', (open) => setOpen(panel, open));
  setOpen(panel, state.getSlice('panelOpen') === true);

  // Auto-open panel and jump to Detail tab when a country is picked
  state.subscribe('selectedCountry', (id) => {
    if (!id) return;
    if (state.getSlice('currentPage') !== 'map') return;
    state.set('panelOpen', true);
    state.set('panelTab', 'detail');
  });
}

function initPanelTabs() {
  const tabs = qs('.panel-tabs');
  if (!tabs) return;

  on(tabs, 'click', '.panel-tab', (_ev, target) => {
    const tab = target.dataset.tab;
    if (tab) {
      state.set('panelTab', tab);
      state.set('panelOpen', true);
    }
  });

  const sync = (tab) => {
    tabs.querySelectorAll('.panel-tab').forEach(t => {
      t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
    });
  };
  state.subscribe('panelTab', sync);
  sync(state.getSlice('panelTab') || 'detail');
}

// ─── Page mounting ──────────────────────────────────────────────────

async function mountPage(pageName, container) {
  if (!container) return;
  if (pageName === currentPageName) return;

  if (currentPageModule?.unmount) {
    currentPageModule.unmount();
  }

  // Map + side panel visibility
  const mapContainer = qs('#mapContainer');
  const sidePanel = qs('#sidePanel');
  const isMap = pageName === 'map';

  if (mapContainer) mapContainer.style.display = isMap ? 'block' : 'none';
  if (sidePanel) sidePanel.style.display = isMap ? '' : 'none';

  if (isMap) {
    container.classList.add('page-root--map');
  } else {
    container.classList.remove('page-root--map');
  }

  container.innerHTML = '';

  // Only load page module for non-map pages (map uses the persistent panel)
  if (!isMap) {
    if (!pageCache[pageName]) {
      const loader = PAGE_MODULES[pageName];
      if (!loader) { console.error(`[router] unknown page: ${pageName}`); return; }
      pageCache[pageName] = await loader();
    }
    currentPageModule = pageCache[pageName];
    if (currentPageModule.mount) {
      await currentPageModule.mount(container);
    }
  } else {
    currentPageModule = null;
  }

  currentPageName = pageName;
  state.set('currentPage', pageName);
}

// ─── Header buttons ──────────────────────────────────────────────────

function wireHeaderButtons() {
  const shareBtn = qs('#btnShare');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const route = state.getSlice('route');
      if (!route?.stops?.length) {
        showToast(t('share.empty'), 'warning');
        return;
      }
      const { copyCurrentURL } = await import('./utils/share.js');
      const ok = await copyCurrentURL();
      showToast(ok ? t('share.copied') : t('share.failed'), ok ? 'success' : 'danger');
    });
  }

  const aiBtn = qs('#aiSuggestBtn');
  if (aiBtn) {
    aiBtn.addEventListener('click', async () => {
      const { initAITrigger } = await import('./features/ai-assistant.js');
      initAITrigger('#aiSuggestBtn');
    });
  }

  const aiBtnIcon = qs('#btnAI');
  if (aiBtnIcon) {
    aiBtnIcon.addEventListener('click', async () => {
      const { initAITrigger } = await import('./features/ai-assistant.js');
      initAITrigger();
    });
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('[sw] registration failed', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
