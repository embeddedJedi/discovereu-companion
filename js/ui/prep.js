// js/ui/prep.js
// "Prep" tab — everything the traveler needs to do before their train
// leaves. Three sections:
//   1. Departure countdown (date picker + live delta)
//   2. Pre-departure checklist (passport, insurance, reservations, …)
//   3. Smart packing list (adapts to the route — beach, north, camp, …)
//
// Check state is stored under `state.prep` and persisted, so ticking
// "passport valid" sticks between sessions without a backend.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';
import { formatDate } from '../utils/format.js';
import { renderTurkishBonus, isTurkishLayerActive } from '../features/turkish-bonus.js';

// ─── Static lists ────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  'passportValid', 'idCard', 'travelInsurance', 'ehicCard',
  'discoverEUPass', 'reservationsBooked', 'bankNotified',
  'emergencyContacts', 'offlineMaps', 'firstNight'
];

const BASE_PACKING = [
  'daypack', 'comfyShoes', 'waterBottle', 'powerBank', 'adapter',
  'basicMeds', 'toiletries', 'phoneCharger', 'cashCard'
];

// Packing add-ons triggered by route characteristics. Each entry is an
// (items, predicate) pair — if the predicate matches any stop country,
// the items are merged into the list.
const PACKING_RULES = [
  {
    items: ['swimsuit', 'sunscreen', 'flipFlops', 'sunglasses'],
    test:  (c) => (c.scores?.beach ?? 0) >= 4
  },
  {
    items: ['warmJacket', 'thermals', 'beanieGloves'],
    test:  (c) => ['IS','NO','FI','SE','EE','LV','LT'].includes(c.id)
  },
  {
    items: ['rainJacket', 'hikingShoes'],
    test:  (c) => (c.scores?.nature ?? 0) >= 4
  },
  {
    items: ['niceOutfit'],
    test:  (c) => (c.scores?.culture ?? 0) >= 4 || (c.scores?.nightlife ?? 0) >= 4
  }
];

// Camping-specific items based on the user's accommodation choice, not a
// country property — still computed here so the packing list is a
// one-stop summary.
const CAMP_ITEMS = ['sleepingBag', 'headlamp', 'dryBag'];

// ─── Wiring ──────────────────────────────────────────────────────────────

export function initPrep() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    if (state.getSlice('panelTab') !== 'prep') return;
    renderInto(body);
  };

  state.subscribe('panelTab',  render);
  state.subscribe('prep',      render);
  state.subscribe('route',     render);
  state.subscribe('user',      render);
  state.subscribe('countries', render);
  state.subscribe('language',  render);

  // Tick the countdown every minute, but only if the tab is visible.
  setInterval(() => {
    if (state.getSlice('panelTab') === 'prep') render();
  }, 60_000);

  render();
}

function renderInto(root) {
  empty(root);
  const prep  = state.getSlice('prep')  || {};
  const route = state.getSlice('route');
  const user  = state.getSlice('user');

  const panel = h('div', { class: 'prep-panel' }, [
    renderHeader(),
    renderCountdown(prep),
    renderChecklist(prep),
    renderPacking(prep, route, user),
    // Turkish bonus section — only renders when the layer is active.
    isTurkishLayerActive()
      ? renderTurkishBonus(() => renderInto(root))  // re-render once JSON arrives
      : null
  ]);

  root.appendChild(panel);
  wireActions(panel);
}

// ─── Header ──────────────────────────────────────────────────────────────

function renderHeader() {
  return h('header', { class: 'prep-header' }, [
    h('h2', { class: 'prep-title' }, t('prep.title')),
    h('p', { class: 'prep-sub' }, t('prep.sub'))
  ]);
}

// ─── Countdown ───────────────────────────────────────────────────────────

function renderCountdown(prep) {
  const iso = prep?.departureDate || '';
  const daysLeft = iso ? daysBetween(new Date(), new Date(iso)) : null;
  const formatted = iso ? formatDate(iso) : null;

  return h('section', { class: 'prep-section prep-countdown' }, [
    h('h3', { class: 'prep-section-title' }, t('prep.countdownTitle')),
    h('div', { class: 'countdown-card' }, [
      iso
        ? h('div', { class: 'countdown-display' }, [
            h('span', { class: 'countdown-number' }, String(Math.max(0, daysLeft))),
            h('span', { class: 'countdown-label' }, t('prep.daysLeft')),
            h('div', { class: 'countdown-date' }, formatted)
          ])
        : h('p', { class: 'countdown-empty' }, t('prep.pickDate')),
      h('label', { class: 'field' }, [
        h('span', { class: 'field-label' }, t('prep.departureDate')),
        h('input', {
          type: 'date',
          class: 'input',
          'data-action': 'set-departure',
          ...(iso ? { value: iso } : {})
        })
      ])
    ])
  ]);
}

// ─── Checklist ───────────────────────────────────────────────────────────

function renderChecklist(prep) {
  const done = prep?.checklistDone || {};
  const completed = CHECKLIST_ITEMS.filter(id => done[id]).length;
  const pct = Math.round((completed / CHECKLIST_ITEMS.length) * 100);

  return h('section', { class: 'prep-section' }, [
    h('div', { class: 'prep-section-head' }, [
      h('h3', { class: 'prep-section-title' }, t('prep.checklistTitle')),
      h('span', { class: 'prep-pill' }, `${completed} / ${CHECKLIST_ITEMS.length}`)
    ]),
    h('div', { class: 'progress progress-sm' }, [
      h('div', { class: 'progress-bar', style: { width: `${pct}%` } })
    ]),
    h('ul', { class: 'prep-list' },
      CHECKLIST_ITEMS.map(id => renderCheckItem('checklist', id, !!done[id])))
  ]);
}

// ─── Packing ─────────────────────────────────────────────────────────────

function renderPacking(prep, route, user) {
  const items = computePackingList(route, user);
  const done = prep?.packingDone || {};
  const completed = items.filter(id => done[id]).length;

  return h('section', { class: 'prep-section' }, [
    h('div', { class: 'prep-section-head' }, [
      h('h3', { class: 'prep-section-title' }, t('prep.packingTitle')),
      h('span', { class: 'prep-pill' }, `${completed} / ${items.length}`)
    ]),
    h('p', { class: 'route-section-sub' }, t('prep.packingSub')),
    h('ul', { class: 'prep-list prep-list-grid' },
      items.map(id => renderCheckItem('packing', id, !!done[id])))
  ]);
}

function computePackingList(route, user) {
  const items = new Set(BASE_PACKING);
  const stops = route?.stops || [];
  const countries = stops
    .map(s => countryById(s.countryId))
    .filter(Boolean);

  for (const rule of PACKING_RULES) {
    if (countries.some(rule.test)) {
      rule.items.forEach(i => items.add(i));
    }
  }
  if (user?.accommodation === 'camp') {
    CAMP_ITEMS.forEach(i => items.add(i));
  }
  return [...items];
}

// ─── Check item (checklist + packing share this row) ────────────────────

function renderCheckItem(kind, id, checked) {
  const labelKey = kind === 'checklist' ? `prep.checklist.${id}` : `prep.packing.${id}`;
  return h('li', { class: 'prep-row' }, [
    h('label', { class: 'prep-row-label' }, [
      h('input', {
        type: 'checkbox',
        class: 'prep-check',
        'data-action': 'toggle',
        'data-kind': kind,
        'data-item-id': id,
        ...(checked ? { checked: '' } : {})
      }),
      h('span', { class: 'prep-row-text' }, t(labelKey))
    ])
  ]);
}

// ─── Actions ─────────────────────────────────────────────────────────────

function wireActions(panel) {
  on(panel, 'change', '[data-action="set-departure"]', (ev) => {
    const value = ev.target.value || null;
    state.update('prep', p => ({ ...p, departureDate: value }));
  });

  on(panel, 'change', '[data-action="toggle"]', (ev, target) => {
    const kind = target.dataset.kind;
    const id = target.dataset.itemId;
    const key = kind === 'checklist' ? 'checklistDone' : 'packingDone';
    state.update('prep', p => ({
      ...p,
      [key]: { ...(p?.[key] || {}), [id]: target.checked }
    }));
  });
}

// ─── Utils ───────────────────────────────────────────────────────────────

function daysBetween(from, to) {
  const ONE_DAY = 1000 * 60 * 60 * 24;
  // Normalise both to midnight so we get whole days, not partial.
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const tDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((tDate - f) / ONE_DAY);
}
