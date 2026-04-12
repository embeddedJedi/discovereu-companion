// js/pages/guide.js
// Guide page: searchable country list → tap for full guide accordion.
// Reuses existing guide.js accordion renderers.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';
import { getCurrentRoute } from '../router.js';

let containerEl = null;
let expandedCountry = null;
let searchQuery = '';
let unsubscribers = [];

export function mount(container) {
  containerEl = container;

  // Check for nested route: #/guide/DE
  const route = getCurrentRoute();
  expandedCountry = route.sub || null;
  searchQuery = '';

  render();

  unsubscribers.push(
    state.subscribe('countries', render),
    state.subscribe('language', render),
    state.subscribe('inclusionMode', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  expandedCountry = null;
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  if (expandedCountry) {
    renderCountryDetail();
  } else {
    renderList();
  }
}

function renderList() {
  const countries = (state.getSlice('countries') || [])
    .filter(c => !c.mapOnly)
    .sort((a, b) => a.name.localeCompare(b.name));

  const page = h('div', { class: 'guide-page' });

  // Search bar
  const searchInput = h('input', {
    type: 'search',
    class: 'guide-search-input',
    placeholder: t('guide.searchPlaceholder'),
    value: searchQuery,
    oninput: (ev) => {
      searchQuery = ev.target.value.toLowerCase();
      renderCountryCards(cardList, countries);
    }
  });
  page.appendChild(h('div', { class: 'guide-search' }, [searchInput]));

  // Inclusion mode chips
  const modeChips = h('div', { class: 'guide-mode-chips' });
  ['default', 'accessibility', 'rainbow'].forEach(mode => {
    const chip = h('button', {
      class: `chip ${state.getSlice('inclusionMode') === mode ? 'chip-active' : ''}`,
      type: 'button',
      onclick: () => state.set('inclusionMode', mode)
    }, t(`guide.mode.${mode}`));
    modeChips.appendChild(chip);
  });
  page.appendChild(modeChips);

  // Country cards
  const cardList = h('div', { class: 'guide-card-list' });
  renderCountryCards(cardList, countries);
  page.appendChild(cardList);

  // Emergency footer
  page.appendChild(h('button', {
    class: 'btn btn-danger guide-emergency-btn',
    type: 'button',
    onclick: showEmergencyModal
  }, [h('span', null, '🆘'), h('span', null, ' ' + t('guide.emergency'))]));

  containerEl.appendChild(page);
}

function renderCountryCards(list, countries) {
  empty(list);
  const filtered = searchQuery
    ? countries.filter(c => c.name.toLowerCase().includes(searchQuery) ||
                            (c.nameLong || '').toLowerCase().includes(searchQuery))
    : countries;

  if (filtered.length === 0) {
    list.appendChild(h('p', { class: 'guide-no-results' }, t('guide.noResults')));
    return;
  }

  filtered.forEach(country => {
    const card = h('button', {
      class: 'guide-country-card',
      type: 'button',
      onclick: () => { expandedCountry = country.id; render(); }
    }, [
      h('span', { class: 'guide-card-flag' }, country.flag || ''),
      h('div', { class: 'guide-card-info' }, [
        h('strong', null, country.name),
        h('div', { class: 'guide-card-scores' },
          ['nature', 'culture', 'food'].map(key =>
            h('span', { class: 'mini-score' }, [
              h('span', { class: 'mini-score-label' }, t(`score.${key}`).charAt(0).toUpperCase()),
              h('span', null, ' ' + String(country.scores?.[key] ?? '–'))
            ])
          )
        )
      ]),
      h('span', { class: 'guide-card-arrow', 'aria-hidden': 'true' }, '›')
    ]);
    list.appendChild(card);
  });
}

async function renderCountryDetail() {
  const country = countryById(expandedCountry);
  if (!country) { expandedCountry = null; render(); return; }

  const wrapper = h('div', { class: 'guide-detail' });

  // Back button
  wrapper.appendChild(h('button', {
    class: 'guide-back-btn',
    type: 'button',
    onclick: () => { expandedCountry = null; render(); }
  }, [h('span', null, '←'), h('span', null, ' ' + t('guide.backToList'))]));

  // Header
  wrapper.appendChild(h('div', { class: 'guide-detail-header' }, [
    h('span', { class: 'guide-detail-flag' }, country.flag || ''),
    h('h1', null, country.name),
    country.nonParticipating
      ? h('span', { class: 'badge badge-warning' }, t('country.nonParticipating'))
      : null
  ]));

  // Guide accordion content
  const accordionArea = h('div', { class: 'guide-accordion-area' });
  try {
    const { renderCountryGuideAccordion, renderCitiesAccordion } = await import('../ui/guide.js');
    renderCountryGuideAccordion(accordionArea, country.id);
    renderCitiesAccordion(accordionArea, country.id);
  } catch (err) {
    console.error('[guide page] failed to load accordions', err);
    accordionArea.textContent = t('guide.loadError');
  }
  wrapper.appendChild(accordionArea);

  // Inclusion info
  try {
    const { renderInclusionSummary } = await import('../ui/inclusion.js');
    if (renderInclusionSummary) {
      const inclusionArea = h('div', { class: 'guide-inclusion-area' });
      renderInclusionSummary(inclusionArea, country.id);
      wrapper.appendChild(inclusionArea);
    }
  } catch (err) { /* inclusion module may not export this */ }

  containerEl.appendChild(wrapper);
}

async function showEmergencyModal() {
  try {
    const mod = await import('../features/emergency.js');
    if (mod.showEmergencyPanel) mod.showEmergencyPanel();
    else if (mod.renderEmergencyPanel) {
      // Fallback: render inline
      const modal = h('div', { class: 'modal-overlay', onclick: (ev) => {
        if (ev.target === modal) modal.remove();
      }});
      const content = h('div', { class: 'modal-content' });
      mod.renderEmergencyPanel(content);
      modal.appendChild(content);
      document.body.appendChild(modal);
    }
  } catch (err) {
    console.error('[guide] emergency module not found', err);
  }
}
