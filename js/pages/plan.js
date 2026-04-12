// js/pages/plan.js
// Plan page: route builder + budget dashboard + departure prep.
// Reuses existing UI modules' render functions in a single-column scroll layout.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let unsubscribers = [];

// Lazy-imported sub-modules (original tab renderers)
let routeBuilderMod = null;
let budgetMod = null;
let prepMod = null;

export async function mount(container) {
  containerEl = container;

  // Lazy-load existing UI modules
  [routeBuilderMod, budgetMod, prepMod] = await Promise.all([
    import('../ui/route-builder.js'),
    import('../ui/budget.js'),
    import('../ui/prep.js')
  ]);

  render();

  unsubscribers.push(
    state.subscribe('route',          render),
    state.subscribe('routeTemplates', render),
    state.subscribe('countries',      render),
    state.subscribe('reservations',   render),
    state.subscribe('user',           render),
    state.subscribe('prep',           render),
    state.subscribe('language',       render)
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

  // Section 1: Route Builder
  const routeSection = h('section', { class: 'plan-section plan-section-route' });
  if (routeBuilderMod?.renderRoutePanel) {
    routeBuilderMod.renderRoutePanel(routeSection);
  }
  page.appendChild(routeSection);

  // Section 2: Budget
  const budgetSection = h('section', { class: 'plan-section plan-section-budget' });
  if (budgetMod?.renderBudgetPanel) {
    budgetMod.renderBudgetPanel(budgetSection);
  }
  page.appendChild(budgetSection);

  // Section 3: Prep
  const prepSection = h('section', { class: 'plan-section plan-section-prep' });
  if (prepMod?.renderPrepPanel) {
    prepMod.renderPrepPanel(prepSection);
  }
  page.appendChild(prepSection);

  containerEl.appendChild(page);
}
