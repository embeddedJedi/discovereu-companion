// js/main.js — v1.1
// Application bootstrap: router-driven SPA shell.
// Each page is a lazy-loaded module with mount(container) / unmount().

import { state } from './state.js';
import { i18n, t } from './i18n/i18n.js';
import { initTheme } from './ui/theme.js';
import { qs } from './utils/dom.js';
import { loadCoreData } from './data/loader.js';
import { hydrateRouteFromHash } from './utils/share.js';
import { showToast } from './ui/toast.js';
import { parseHash, onRouteChange } from './router.js';
import { initBottomNav } from './ui/bottom-nav.js';

const pageCache = {};
const PAGE_MODULES = {
  map:   () => import('./pages/map.js'),
  plan:  () => import('./pages/plan.js'),
  fun:   () => import('./pages/fun.js'),
  guide: () => import('./pages/guide.js'),
  more:  () => import('./pages/more.js')
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

    // 3. Wire language switcher (header)
    const langSelect = qs('#langSelect');
    if (langSelect) {
      langSelect.value = savedLang;
      langSelect.addEventListener('change', async (ev) => {
        await i18n.load(ev.target.value);
      });
    }

    // 4. Load core data
    await loadCoreData();

    // 5. Check for share URL before router takes over
    const initialHash = location.hash;
    if (initialHash.startsWith('#route=')) {
      hydrateRouteFromHash();
    }

    // 6. Init map (persistent — lives across page switches)
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

    // 7. Bottom navigation
    const navRoot = qs('#bottomNavRoot');
    if (navRoot) initBottomNav(navRoot);

    // 8. Router — mount initial page
    const pageRoot = qs('#pageRoot');
    onRouteChange((route) => mountPage(route.page, pageRoot));

    const initial = parseHash();
    await mountPage(initial.page, pageRoot);

    // 9. Wire header buttons
    wireHeaderButtons();

    // 10. Service worker
    registerServiceWorker();

    // 11. Hide loading shell
    const loader = qs('#appLoading');
    if (loader) {
      loader.setAttribute('data-hidden', 'true');
      setTimeout(() => loader.remove(), 400);
    }

    // 12. Welcome wizard (first visit)
    const { shouldShowWizard, openWizard } = await import('./ui/welcome-wizard.js');
    if (shouldShowWizard()) {
      setTimeout(openWizard, 500);
    }
    const settingsBtn = qs('#btnSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => openWizard());
    }

    console.info('[DiscoverEU Companion v1.1] ready');
  } catch (err) {
    console.error('[main] boot failed', err);
    const loader = qs('#appLoading');
    if (loader) loader.innerHTML = '<p style="color: var(--danger)">Failed to load app. Check console.</p>';
  }
}

async function mountPage(pageName, container) {
  if (!container) return;
  if (pageName === currentPageName) return;

  // Unmount current page
  if (currentPageModule?.unmount) {
    currentPageModule.unmount();
  }

  // Map container visibility
  const mapContainer = qs('#mapContainer');
  if (mapContainer) {
    mapContainer.style.display = pageName === 'map' ? 'block' : 'none';
  }

  // Clear page root
  container.innerHTML = '';

  // Load and mount new page
  if (!pageCache[pageName]) {
    const loader = PAGE_MODULES[pageName];
    if (!loader) { console.error(`[router] unknown page: ${pageName}`); return; }
    pageCache[pageName] = await loader();
  }

  currentPageModule = pageCache[pageName];
  currentPageName = pageName;
  state.set('currentPage', pageName);

  if (currentPageModule.mount) {
    await currentPageModule.mount(container);
  }
}

function wireHeaderButtons() {
  // Share button
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

  // AI suggest button
  const aiBtn = qs('#aiSuggestBtn');
  if (aiBtn) {
    aiBtn.addEventListener('click', async () => {
      const { initAITrigger } = await import('./features/ai-assistant.js');
      initAITrigger('#aiSuggestBtn');
    });
  }

  // AI header icon button
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
