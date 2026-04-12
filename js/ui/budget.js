// js/ui/budget.js
// Budget calculator tab.
// Takes state.route + state.user + countries.costPerDay → produces
// per-category totals and a group/per-person summary. Pure calc stays
// at the top of the file so it's easy to reuse from CO2 / Wrapped / PDF
// exports later.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';
import { formatCurrency } from '../utils/format.js';
import { getRouteReservations } from '../features/reservations.js';
import { getEffectiveLegs } from '../features/effective-legs.js';

// ─── Config ──────────────────────────────────────────────────────────────

const BUDGET_LEVELS = ['budget', 'moderate', 'comfort'];
const BUDGET_TO_TIER = { budget: 'low', moderate: 'mid', comfort: 'high' };

const ACCOMMODATION = ['hostel', 'airbnb', 'camp', 'couchsurf'];
const ACC_MODIFIER = {
  hostel:   1.0,
  airbnb:   1.6,
  camp:     0.4,
  couchsurf: 0.1
};

const FOOD_STYLES = ['budget', 'moderate', 'comfort'];
const FOOD_MODIFIER = { budget: 0.7, moderate: 1.0, comfort: 1.5 };

// Split the per-day number into categories (base shares before modifiers).
const SHARE = { accommodation: 0.40, food: 0.35, activities: 0.25 };

// ─── Pure computation ────────────────────────────────────────────────────

/**
 * Compute a full budget breakdown for a route + user preferences.
 * Returns zeros for an empty route so the UI has a stable shape.
 *
 *   const budget = computeBudget(state.getSlice('route'), state.getSlice('user'));
 */
export function computeBudget(route, user) {
  const stops = getEffectiveLegs(route);
  const tier = BUDGET_TO_TIER[user?.budget] || 'mid';
  const accMod  = ACC_MODIFIER[user?.accommodation] ?? 1.0;
  const foodMod = FOOD_MODIFIER[user?.foodStyle]    ?? 1.0;
  const groupSize = Math.max(1, Number(user?.groupSize) || 1);

  let accommodation = 0;
  let food = 0;
  let activities = 0;
  let nightsTotal = 0;

  for (const stop of stops) {
    const country = countryById(stop.countryId);
    const perDay = country?.costPerDay?.[tier] ?? 0;
    const nights = Math.max(0, Number(stop.nights) || 0);
    nightsTotal += nights;

    accommodation += perDay * nights * SHARE.accommodation * accMod;
    food          += perDay * nights * SHARE.food          * foodMod;
    activities    += perDay * nights * SHARE.activities;
  }

  // Transport: DiscoverEU pass is free, so transport cost = sum of the
  // paid reservations the pass doesn't cover.
  const reservations = getRouteReservations(route);
  const transport = reservations
    .filter(r => r.mandatory && r.costEUR)
    .reduce((sum, r) => sum + r.costEUR, 0);

  const perPerson = accommodation + food + activities + transport;
  const groupTotal = perPerson * groupSize;

  return {
    accommodation: Math.round(accommodation),
    food: Math.round(food),
    activities: Math.round(activities),
    transport: Math.round(transport),
    perPerson: Math.round(perPerson),
    groupTotal: Math.round(groupTotal),
    nightsTotal,
    groupSize,
    empty: stops.length === 0
  };
}

// ─── Render ──────────────────────────────────────────────────────────────

export function initBudget() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    if (state.getSlice('panelTab') !== 'budget') return;
    renderInto(body);
  };

  state.subscribe('panelTab',  render);
  state.subscribe('route',     render);
  state.subscribe('user',      render);
  state.subscribe('countries', render);
  state.subscribe('language',  render);

  render();
}

function renderInto(root) {
  empty(root);
  const route = state.getSlice('route');
  const user  = state.getSlice('user');
  const budget = computeBudget(route, user);

  const panel = h('div', { class: 'budget-panel' }, [
    h('header', { class: 'budget-header' }, [
      h('h2', { class: 'budget-title' }, t('budget.title'))
    ]),

    renderControls(user),
    renderSummary(budget),
    budget.empty ? renderEmptyHint() : renderBreakdown(budget)
  ]);

  root.appendChild(panel);
  wireActions(panel);
}

function renderEmptyHint() {
  return h('div', { class: 'alert alert-info' }, [
    h('span', null, t('budget.emptyHint'))
  ]);
}

// ─── Controls ────────────────────────────────────────────────────────────

function renderControls(user) {
  return h('section', { class: 'budget-controls' }, [
    // Group size stepper
    h('div', { class: 'field' }, [
      h('label', { class: 'field-label' }, t('budget.groupSize')),
      h('div', { class: 'stepper' }, [
        h('button', {
          class: 'nights-btn',
          type: 'button',
          'data-action': 'dec-group',
          'aria-label': '-1',
          disabled: (user?.groupSize || 1) <= 1
        }, '−'),
        h('span', { class: 'stepper-value' }, String(user?.groupSize || 1)),
        h('button', {
          class: 'nights-btn',
          type: 'button',
          'data-action': 'inc-group',
          'aria-label': '+1',
          disabled: (user?.groupSize || 1) >= 8
        }, '+')
      ])
    ]),

    // Budget level
    h('div', { class: 'field' }, [
      h('label', { class: 'field-label' }, t('budget.level.title')),
      h('div', { class: 'chip-row' },
        BUDGET_LEVELS.map(level => h('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': (user?.budget || 'moderate') === level ? 'true' : 'false',
          'data-control': 'budget',
          'data-value': level
        }, t(`budget.level.${level}`))))
    ]),

    // Accommodation
    h('div', { class: 'field' }, [
      h('label', { class: 'field-label' }, t('budget.accommodation.title')),
      h('div', { class: 'chip-row' },
        ACCOMMODATION.map(a => h('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': (user?.accommodation || 'hostel') === a ? 'true' : 'false',
          'data-control': 'accommodation',
          'data-value': a
        }, t(`budget.accommodation.${a}`))))
    ]),

    // Food style
    h('div', { class: 'field' }, [
      h('label', { class: 'field-label' }, t('budget.food.title')),
      h('div', { class: 'chip-row' },
        FOOD_STYLES.map(f => h('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': (user?.foodStyle || 'moderate') === f ? 'true' : 'false',
          'data-control': 'foodStyle',
          'data-value': f
        }, t(`budget.food.${f}`))))
    ])
  ]);
}

// ─── Summary card ────────────────────────────────────────────────────────

function renderSummary(budget) {
  return h('section', { class: 'budget-summary' }, [
    h('div', { class: 'budget-totals' }, [
      h('div', { class: 'stat budget-stat-primary' }, [
        h('span', { class: 'stat-label' }, t('budget.totals.perPerson')),
        h('span', { class: 'stat-value' }, formatCurrency(budget.perPerson)),
        h('span', { class: 'stat-unit' }, t('budget.totals.perTrip'))
      ]),
      h('div', { class: 'stat' }, [
        h('span', { class: 'stat-label' }, t('budget.totals.group', { n: budget.groupSize })),
        h('span', { class: 'stat-value' }, formatCurrency(budget.groupTotal))
      ])
    ])
  ]);
}

// ─── Breakdown rows ──────────────────────────────────────────────────────

function renderBreakdown(budget) {
  const max = Math.max(budget.accommodation, budget.food, budget.activities, budget.transport, 1);

  const row = (key, value, icon) => {
    const pct = Math.round((value / max) * 100);
    return h('div', { class: 'budget-row' }, [
      h('div', { class: 'budget-row-head' }, [
        h('span', { class: 'budget-row-icon', 'aria-hidden': 'true' }, icon),
        h('span', { class: 'budget-row-label' }, t(`budget.totals.${key}`)),
        h('span', { class: 'budget-row-value' }, formatCurrency(value))
      ]),
      h('div', { class: 'progress progress-sm' }, [
        h('div', { class: 'progress-bar', style: { width: `${pct}%` } })
      ])
    ]);
  };

  return h('section', { class: 'budget-breakdown' }, [
    h('h3', { class: 'route-section-title' }, t('budget.breakdown')),
    row('accommodation', budget.accommodation, '🛏'),
    row('food',          budget.food,          '🍽'),
    row('activities',    budget.activities,    '🎟'),
    row('transport',     budget.transport,     '🚆')
  ]);
}

// ─── Actions ─────────────────────────────────────────────────────────────

function wireActions(panel) {
  on(panel, 'click', '[data-action="inc-group"]', () => {
    state.update('user', u => ({ ...u, groupSize: Math.min(8, (u.groupSize || 1) + 1) }));
  });
  on(panel, 'click', '[data-action="dec-group"]', () => {
    state.update('user', u => ({ ...u, groupSize: Math.max(1, (u.groupSize || 1) - 1) }));
  });
  on(panel, 'click', '[data-control="budget"]', (_ev, target) => {
    state.update('user', u => ({ ...u, budget: target.dataset.value }));
  });
  on(panel, 'click', '[data-control="accommodation"]', (_ev, target) => {
    state.update('user', u => ({ ...u, accommodation: target.dataset.value }));
  });
  on(panel, 'click', '[data-control="foodStyle"]', (_ev, target) => {
    state.update('user', u => ({ ...u, foodStyle: target.dataset.value }));
  });
}

// ─── Page-level export ──────────────────────────────────────────────────
export { renderInto as renderBudgetPanel };
