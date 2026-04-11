// js/ui/welcome-wizard.js
// First-visit 4-step onboarding modal. Reuses the existing .modal-overlay
// pattern from wrapped.js. Answers feed state.user + state.filters; the
// priorities step delegates to inclusion.js for the Fewer-opportunities
// preset logic (single source of truth).

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on } from '../utils/dom.js';
import { activateFewerOpportunitiesMode } from './inclusion.js';

const STEP_COUNT = 4;

// Transient state held in the module while the wizard is open.
let answers = {
  homeCountry: null,
  groupSize: null,
  budget: null,
  priorities: new Set()
};
let currentStep = 0;
let overlayEl = null;

export function shouldShowWizard() {
  return state.getSlice('user')?.onboarded !== true;
}

export function openWizard() {
  currentStep = 0;
  answers = { homeCountry: null, groupSize: null, budget: null, priorities: new Set() };
  // Pre-fill the home country guess from browser locale.
  const guess = (navigator.language || 'en').split('-')[1]?.toUpperCase() || 'TR';
  answers.homeCountry = guess;

  overlayEl = h('div', { class: 'modal-overlay wizard-overlay', 'data-modal': 'wizard' }, [
    h('div', { class: 'modal wizard-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wizard-title' }, [
      h('header', { class: 'wizard-header' }, [
        h('h3', { id: 'wizard-title', class: 'wizard-title' }, t('wizard.title')),
        h('button', {
          class: 'modal-close',
          type: 'button',
          'aria-label': t('modal.close'),
          'data-action': 'wizard-skip'
        }, '×')
      ]),
      h('div', { class: 'wizard-progress', role: 'progressbar',
                 'aria-valuenow': '1', 'aria-valuemin': '1', 'aria-valuemax': String(STEP_COUNT) }, [
        ...Array.from({ length: STEP_COUNT }, (_, i) => h('span', { class: 'wizard-dot' + (i === 0 ? ' is-active' : '') }))
      ]),
      h('div', { class: 'wizard-body' }),
      h('footer', { class: 'wizard-footer' }, [
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'wizard-skip' }, t('wizard.skip')),
        h('div', { class: 'wizard-spacer' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'wizard-prev' }, t('wizard.prev')),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'wizard-next' }, t('wizard.next'))
      ])
    ])
  ]);

  document.body.appendChild(overlayEl);
  wireActions();
  renderStep();
}

function wireActions() {
  on(overlayEl, 'click', '[data-action="wizard-skip"]', finishSkip);
  on(overlayEl, 'click', '[data-action="wizard-prev"]', prevStep);
  on(overlayEl, 'click', '[data-action="wizard-next"]', nextStep);
  on(overlayEl, 'click', '[data-action="wizard-country"]', (_ev, target) => {
    answers.homeCountry = target.value || target.dataset.country;
  });
  on(overlayEl, 'change', 'select[data-action="wizard-country-select"]', (ev) => {
    answers.homeCountry = ev.target.value;
  });
  on(overlayEl, 'click', '[data-action="wizard-group"]', (_ev, target) => {
    answers.groupSize = Number(target.dataset.size);
    renderStep();
  });
  on(overlayEl, 'click', '[data-action="wizard-budget"]', (_ev, target) => {
    answers.budget = target.dataset.budget;
    renderStep();
  });
  on(overlayEl, 'click', '[data-action="wizard-priority"]', (_ev, target) => {
    const p = target.dataset.priority;
    if (answers.priorities.has(p)) answers.priorities.delete(p);
    else answers.priorities.add(p);
    renderStep();
  });
  document.addEventListener('keydown', escListener);
}

function escListener(ev) {
  if (ev.key === 'Escape') finishSkip();
}

function renderStep() {
  if (!overlayEl) return;
  const body = overlayEl.querySelector('.wizard-body');
  if (!body) return;
  body.innerHTML = '';
  body.appendChild(renderQuestion(currentStep));

  // Update dots
  overlayEl.querySelectorAll('.wizard-dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentStep);
  });
  overlayEl.querySelector('.wizard-progress').setAttribute('aria-valuenow', String(currentStep + 1));

  // Footer buttons
  const prevBtn = overlayEl.querySelector('[data-action="wizard-prev"]');
  const nextBtn = overlayEl.querySelector('[data-action="wizard-next"]');
  prevBtn.disabled = currentStep === 0;
  nextBtn.textContent = currentStep === STEP_COUNT - 1 ? t('wizard.finish') : t('wizard.next');
}

function renderQuestion(stepIndex) {
  switch (stepIndex) {
    case 0: return renderQ1HomeCountry();
    // Cases 1-3 filled in Task 16.
    default: return h('div', null, 'TODO');
  }
}

function renderQ1HomeCountry() {
  // Use the existing countries slice to build a <select>.
  const countries = state.getSlice('countries') || [];
  const options = [{ id: 'TR', name: 'Türkiye' }, ...countries]
    .reduce((map, c) => (map[c.id] = c.name, map), {});

  return h('div', { class: 'wizard-step' }, [
    h('h4', null, t('wizard.q1.title')),
    h('p',  { class: 'wizard-help' }, t('wizard.q1.help')),
    h('select', {
      class: 'input',
      'data-action': 'wizard-country-select',
      'aria-label': t('wizard.q1.title')
    }, Object.entries(options).map(([id, name]) => h('option', {
      value: id,
      ...(answers.homeCountry === id ? { selected: '' } : {})
    }, `${name} (${id})`)))
  ]);
}

function nextStep() {
  if (currentStep < STEP_COUNT - 1) {
    currentStep++;
    renderStep();
  } else {
    finish();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function finish() {
  // Apply answers
  state.update('user', u => ({
    ...u,
    homeCountry: answers.homeCountry || u.homeCountry,
    groupSize:   answers.groupSize   || u.groupSize,
    budget:      answers.budget      || u.budget,
    onboarded:   true
  }));

  // Priorities → filters preset
  if (answers.priorities.has('accessible') || answers.priorities.has('lgbtq') || answers.priorities.has('lowBudget')) {
    activateFewerOpportunitiesMode();
  } else {
    if (answers.priorities.has('green')) {
      state.update('filters', f => ({ ...f, green: true }));
    }
  }

  closeWizard();
}

function finishSkip() {
  // Skip still marks onboarded so the wizard doesn't reappear on every visit.
  state.update('user', u => ({ ...u, onboarded: true }));
  closeWizard();
}

function closeWizard() {
  document.removeEventListener('keydown', escListener);
  overlayEl?.remove();
  overlayEl = null;
}
