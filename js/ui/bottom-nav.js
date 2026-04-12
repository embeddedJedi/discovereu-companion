// js/ui/bottom-nav.js
// 5-item bottom navigation bar, syncs with router.
// On desktop (≥1024px) this renders as a left sidebar via CSS.

import { navigate, getCurrentRoute, onRouteChange } from '../router.js';
import { t } from '../i18n/i18n.js';
import { h, on } from '../utils/dom.js';
import { state } from '../state.js';

const NAV_ITEMS = [
  { page: 'map',   icon: 'map-pin',   labelKey: 'nav.map'   },
  { page: 'plan',  icon: 'clipboard', labelKey: 'nav.plan'  },
  { page: 'fun',   icon: 'target',    labelKey: 'nav.fun'   },
  { page: 'guide', icon: 'compass',   labelKey: 'nav.guide' },
  { page: 'more',  icon: 'grid',      labelKey: 'nav.more'  }
];

const ICONS = {
  'map-pin': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'clipboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  'target': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  'compass': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  'grid': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/><circle cx="5" cy="19" r="1"/></svg>'
};

/**
 * Mount the bottom nav into the given container element.
 * Returns a cleanup function.
 */
export function initBottomNav(container) {
  const nav = h('nav', {
    class: 'bottom-nav',
    role: 'navigation',
    'aria-label': 'Main sections'
  });

  const buttons = NAV_ITEMS.map(item => {
    const btn = h('button', {
      class: 'bottom-nav-item',
      type: 'button',
      dataset: { page: item.page },
      'aria-label': t(item.labelKey)
    });
    btn.innerHTML = ICONS[item.icon];
    btn.appendChild(h('span', null, t(item.labelKey)));
    return btn;
  });

  buttons.forEach(btn => nav.appendChild(btn));
  container.appendChild(nav);

  // Click handler
  on(nav, 'click', '.bottom-nav-item', (_ev, target) => {
    const page = target.dataset.page || target.closest('[data-page]')?.dataset.page;
    if (page) navigate(page);
  });

  // Sync active state with router
  function syncActive(route) {
    buttons.forEach(btn => {
      const isActive = btn.dataset.page === route.page;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  const unsub = onRouteChange(syncActive);
  syncActive(getCurrentRoute());

  // Re-render labels on language change
  const unsubLang = state.subscribe('language', () => {
    buttons.forEach((btn, i) => {
      const span = btn.querySelector('span');
      if (span) span.textContent = t(NAV_ITEMS[i].labelKey);
      btn.setAttribute('aria-label', t(NAV_ITEMS[i].labelKey));
    });
  });

  return () => { unsub(); unsubLang(); nav.remove(); };
}
