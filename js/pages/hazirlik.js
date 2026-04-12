// js/pages/hazirlik.js
// Hazırlık page: prep, visa, insurance, checklists, Turkish bonus.
// Standalone page — no map interaction.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let unsubscribers = [];
let prepMod = null;

export async function mount(container) {
  containerEl = container;
  prepMod = await import('../ui/prep.js');
  render();
  unsubscribers.push(
    state.subscribe('prep', render),
    state.subscribe('user', render),
    state.subscribe('route', render),
    state.subscribe('language', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  const page = h('div', { class: 'plan-page' });
  page.appendChild(h('h1', { class: 'page-title' }, t('hazirlik.pageTitle')));

  // Prep section (countdown, checklist, packing)
  const prepSection = h('section', { class: 'plan-section' });
  if (prepMod?.renderPrepPanel) {
    prepMod.renderPrepPanel(prepSection);
  }
  page.appendChild(prepSection);

  // Turkish bonus (conditional)
  const lang = state.getSlice('language');
  const user = state.getSlice('user');
  const route = state.getSlice('route');
  const showTurkish = lang === 'tr' || user?.homeCountry === 'TR' ||
    (route?.stops?.[0]?.countryId === 'TR');
  if (showTurkish) {
    const turkishSection = h('section', { class: 'plan-section' });
    import('../features/turkish-bonus.js').then(mod => {
      if (mod.renderTurkishBonus) mod.renderTurkishBonus(turkishSection);
    }).catch(() => {});
    page.appendChild(turkishSection);
  }

  containerEl.appendChild(page);
}
