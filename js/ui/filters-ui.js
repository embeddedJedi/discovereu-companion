// js/ui/filters-ui.js
// Renders the "Filters" tab of the side panel. Writes to state.filters,
// which the map layer subscribes to — so every chip click re-colours the map.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';
import { countMatches, filtersActive } from '../map/filters.js';

const CATEGORIES = ['nature', 'culture', 'nightlife', 'food', 'beach', 'history'];
const BUDGET_LEVELS = ['all', 'low', 'mid', 'high'];

/**
 * Wire the filters tab. Subscribes to state so the panel refreshes when
 * the tab becomes active, the filter slice mutates, or the country list
 * loads (for the live result count).
 */
export function initFiltersUI() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    if (state.getSlice('panelTab') !== 'filters') return;
    renderInto(body);
  };

  state.subscribe('panelTab',  render);
  state.subscribe('filters',   render);
  state.subscribe('countries', render);
  state.subscribe('language',  render);

  render();
}

function renderInto(root) {
  empty(root);
  const filters = state.getSlice('filters') || {};
  const countries = state.getSlice('countries') || [];
  const matches = countMatches(countries, filters);

  const panel = h('div', { class: 'filters-panel' }, [
    h('header', { class: 'filters-header' }, [
      h('h2', { class: 'filters-title' }, t('filters.title')),
      h('p', { class: 'filters-count' },
        formatCount(matches, filters))
    ]),

    renderCategoryGroup(filters),
    renderBudgetGroup(filters),
    renderInclusionGroup(filters),
    renderInterrailGroup(filters),
    renderNightShieldGroup(filters),

    h('div', { class: 'filters-actions' }, [
      h('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        'data-action': 'reset-filters',
        disabled: !filtersActive(filters)
      }, t('filters.reset'))
    ])
  ]);

  root.appendChild(panel);
  wireInteractions(panel);
}

function formatCount(n, filters) {
  if (!filtersActive(filters)) {
    return t('filters.countAll', { n });
  }
  return t('filters.countFiltered', { n });
}

// ─── Groups ──────────────────────────────────────────────────────────────

function renderCategoryGroup(filters) {
  const active = new Set(filters.categories || []);

  const chips = CATEGORIES.map(cat => h('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': active.has(cat) ? 'true' : 'false',
    'data-filter': 'category',
    'data-value': cat
  }, t(`filters.categories.${cat}`)));

  return h('section', { class: 'filter-group' }, [
    h('h3', { class: 'filter-group-title' }, t('filters.categories.title')),
    h('div', { class: 'chip-row' }, chips)
  ]);
}

function renderBudgetGroup(filters) {
  const current = filters.budget || 'all';

  const chips = BUDGET_LEVELS.map(level => h('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': current === level ? 'true' : 'false',
    'data-filter': 'budget',
    'data-value': level
  }, t(`filters.budgetLevel.${level}`)));

  return h('section', { class: 'filter-group' }, [
    h('h3', { class: 'filter-group-title' }, t('filters.budget.title')),
    h('div', { class: 'chip-row' }, chips)
  ]);
}

function renderInclusionGroup(filters) {
  return h('section', { class: 'filter-group' }, [
    h('h3', { class: 'filter-group-title' }, t('filters.inclusion.title')),
    renderToggle('accessibility', !!filters.accessibility, t('filters.inclusion.accessibility')),
    renderToggle('lgbtqSafe',     !!filters.lgbtqSafe,     t('filters.inclusion.lgbtqSafe'))
  ]);
}

function renderInterrailGroup(filters) {
  return h('section', { class: 'filter-group' }, [
    h('h3', { class: 'filter-group-title' }, t('filters.interrail.title')),
    renderToggle('interrailOnly', filters.interrailOnly !== false, t('filters.interrail.only'))
  ]);
}

function renderNightShieldGroup(filters) {
  return h('section', { class: 'filter-group' }, [
    h('h3', { class: 'filter-group-title' }, t('nightShield.groupTitle')),
    renderToggle('hideLateArrival', !!filters.hideLateArrival, t('nightShield.hideLateArrivalToggle')),
    h('p', { class: 'filter-group-help' }, t('nightShield.nightShieldDescription'))
  ]);
}

function renderToggle(key, checked, label) {
  const input = h('input', {
    type: 'checkbox',
    class: 'toggle-input',
    'data-filter': 'toggle',
    'data-value': key,
    ...(checked ? { checked: '' } : {})
  });

  return h('label', { class: 'toggle-row' }, [
    input,
    h('span', { class: 'toggle-slider', 'aria-hidden': 'true' }),
    h('span', { class: 'toggle-label' }, label)
  ]);
}

// ─── Event wiring ────────────────────────────────────────────────────────

function wireInteractions(panel) {
  // Category chips
  on(panel, 'click', '[data-filter="category"]', (_ev, target) => {
    const cat = target.dataset.value;
    state.update('filters', f => {
      const next = new Set(f.categories || []);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return { ...f, categories: [...next] };
    });
  });

  // Budget chips (single-select)
  on(panel, 'click', '[data-filter="budget"]', (_ev, target) => {
    const value = target.dataset.value;
    state.update('filters', f => ({ ...f, budget: value }));
  });

  // Toggles (checkboxes)
  on(panel, 'change', '[data-filter="toggle"]', (_ev, target) => {
    const key = target.dataset.value;
    state.update('filters', f => ({ ...f, [key]: target.checked }));
  });

  // Reset
  on(panel, 'click', '[data-action="reset-filters"]', () => {
    state.update('filters', () => ({
      categories: [],
      budget: 'all',
      interrailOnly: true,
      accessibility: false,
      lgbtqSafe: false,
      green: false,
      hideLateArrival: false
    }));
  });
}
