// js/features/turkish-bonus.js
// Turkish applicant layer. Renders three cards — Schengen checklist,
// Sofia Express callout, TL budget tips — into any container the caller
// passes in. The whole module is a no-op unless the layer should show
// (Turkish UI language OR homeCountry === 'TR' OR route starts with TR).

import { state } from '../state.js';
import { loadJson } from '../data/loader.js';
import { h, on } from '../utils/dom.js';

let bonusData = null;
let loadPromise = null;

function ensureData() {
  if (bonusData) return Promise.resolve(bonusData);
  if (loadPromise) return loadPromise;
  loadPromise = loadJson('turkish-bonus.json')
    .then(d => { bonusData = d; return d; })
    .catch(err => {
      console.warn('[turkish-bonus] data unavailable', err);
      return null;
    });
  return loadPromise;
}

/** Decide whether the Turkish bonus layer should render for the current user. */
export function isTurkishLayerActive() {
  const lang = state.getSlice('language');
  const user = state.getSlice('user');
  const route = state.getSlice('route');
  if (lang === 'tr') return true;
  if (user?.homeCountry === 'TR') return true;
  if (route?.stops?.[0]?.countryId === 'TR') return true;
  return false;
}

/**
 * Render the Turkish bonus block synchronously.
 *
 * On the first call the JSON hasn't loaded yet, so we fire the fetch,
 * schedule a one-shot `onReady` callback, and return a loading stub.
 * Once the data is cached we return `buildLayer(bonusData)` immediately
 * WITHOUT scheduling another callback — otherwise every re-render would
 * queue a fresh microtask that re-invokes the caller, causing an
 * infinite render loop (seen when the Prep tab re-rendered after any
 * checkbox change).
 */
export function renderTurkishBonus(onReady) {
  if (!isTurkishLayerActive()) return document.createDocumentFragment();

  // Cache hit — synchronous render, no callback scheduling.
  if (bonusData) return buildLayer(bonusData);

  // First render: trigger the fetch and let the caller know once.
  ensureData().then(() => {
    if (typeof onReady === 'function' && bonusData) onReady(bonusData);
  });
  return h('div', { class: 'tr-bonus-loading', 'aria-busy': 'true' });
}

// ─── DOM builder ─────────────────────────────────────────────────────────

function buildLayer(data) {
  const lang = state.getSlice('language');
  const useTr = lang === 'tr';

  return h('div', { class: 'tr-bonus' }, [
    renderSchengenCard(data, useTr),
    renderSofiaCard(data, useTr),
    renderBudgetCard(data, useTr)
  ]);
}

function renderSchengenCard(data, useTr) {
  const prep = state.getSlice('prep') || {};
  const done = prep?.schengenDone || {};
  const items = data.schengenChecklist || [];
  const completed = items.filter(it => done[it.id]).length;

  return h('section', { class: 'tr-card tr-card-schengen' }, [
    h('header', { class: 'tr-card-head' }, [
      h('span', { class: 'tr-flag' }, '🇹🇷'),
      h('div', null, [
        h('h3', { class: 'tr-card-title' },
          useTr ? 'Schengen vize listesi' : 'Schengen visa checklist'),
        h('p', { class: 'tr-card-sub' },
          useTr
            ? 'Başvuruna başlamadan önce bu evrakları hazırla.'
            : 'Have these ready before you apply.')
      ]),
      h('span', { class: 'prep-pill' }, `${completed} / ${items.length}`)
    ]),
    h('ul', { class: 'prep-list' },
      items.map(item => h('li', { class: 'prep-row' }, [
        h('label', { class: 'prep-row-label' }, [
          h('input', {
            type: 'checkbox',
            class: 'prep-check',
            'data-action': 'toggle-schengen',
            'data-item-id': item.id,
            ...(done[item.id] ? { checked: '' } : {})
          }),
          h('span', { class: 'prep-row-text' },
            useTr ? item.labelTr : item.labelEn)
        ])
      ])))
  ]);
}

function renderSofiaCard(data, useTr) {
  const s = data.sofiaExpress || {};
  const tips = useTr ? (s.tipsTr || []) : (s.tips || []);

  return h('section', { class: 'tr-card tr-card-sofia' }, [
    h('header', { class: 'tr-card-head' }, [
      h('span', { class: 'tr-icon' }, '🚆'),
      h('div', null, [
        h('h3', { class: 'tr-card-title' }, s.name || 'Sofia Express'),
        h('p', { class: 'tr-card-sub' }, useTr ? s.summaryTr : s.summary)
      ])
    ]),
    h('dl', { class: 'tr-meta' }, [
      h('dt', null, useTr ? 'Güzergah' : 'Route'),       h('dd', null, s.route || '—'),
      h('dt', null, useTr ? 'Süre' : 'Duration'),         h('dd', null, s.duration || '—'),
      h('dt', null, useTr ? 'Operatör' : 'Operator'),     h('dd', null, s.operator || '—'),
      h('dt', null, useTr ? 'Fiyat' : 'Cost'),            h('dd', null, s.cost || '—')
    ]),
    tips.length > 0
      ? h('ul', { class: 'tr-tips' }, tips.map(tip => h('li', null, tip)))
      : null,
    s.bookingUrl
      ? h('a', {
          class: 'btn btn-primary btn-sm',
          href: s.bookingUrl,
          target: '_blank',
          rel: 'noopener'
        }, useTr ? 'TCDD bileti' : 'Book at TCDD')
      : null
  ]);
}

function renderBudgetCard(data, useTr) {
  const b = data.budgetTips || {};
  const cards = b.cards || [];

  return h('section', { class: 'tr-card tr-card-budget' }, [
    h('header', { class: 'tr-card-head' }, [
      h('span', { class: 'tr-icon' }, '💳'),
      h('div', null, [
        h('h3', { class: 'tr-card-title' },
          useTr ? 'TL bütçe ipuçları' : 'Turkish lira budget tips'),
        h('p', { class: 'tr-card-sub' }, useTr ? b.noteTr : b.note)
      ])
    ]),
    h('div', { class: 'tr-cards' },
      cards.map(c => h('div', { class: 'tr-sub-card' }, [
        h('strong', null, c.name),
        h('span', null, useTr ? c.whyTr : c.why)
      ])))
  ]);
}

// ─── Action wiring (attached once at module load) ────────────────────────

document.addEventListener('change', (ev) => {
  const target = ev.target;
  if (target.dataset?.action !== 'toggle-schengen') return;
  const id = target.dataset.itemId;
  state.update('prep', p => ({
    ...p,
    schengenDone: { ...(p?.schengenDone || {}), [id]: target.checked }
  }));
});
