// js/features/turkish-bonus.js
// Turkish applicant layer. Renders three cards — Schengen checklist,
// Sofia Express callout, TL budget tips — into any container the caller
// passes in. The whole module is a no-op unless the layer should show
// (Turkish UI language OR homeCountry === 'TR' OR route starts with TR).

import { state } from '../state.js';
import { loadJson, loadConsulates } from '../data/loader.js';
import { h, on } from '../utils/dom.js';
import { buildICS, downloadICS } from '../utils/ics.js';
import { t } from '../i18n/i18n.js';

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

  const wrap = h('div', { class: 'tr-bonus' }, [
    renderSchengenCard(data, useTr),
    renderSofiaCard(data, useTr),
    renderBudgetCard(data, useTr)
  ]);

  // Async consulate card (it needs tr-consulates.json)
  const consulateHost = h('div', { class: 'tr-consulate-host' });
  wrap.appendChild(consulateHost);
  renderConsulateCard().then(card => { if (card) consulateHost.appendChild(card); });

  return wrap;
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

// ─────────────────────────────────────────────────────────────────────────────
// Consulate reminder — 4th Turkish bonus card (sub-project 2)
// ─────────────────────────────────────────────────────────────────────────────

let _consulatesCache = null;
async function ensureConsulates() {
  if (_consulatesCache) return _consulatesCache;
  _consulatesCache = await loadConsulates().catch(() => null);
  return _consulatesCache;
}

export function getAppointment() {
  return state.getSlice('user')?.consulateAppointment || null;
}

export function saveAppointment({ countryId, city, datetime, notes }) {
  state.update('user', prev => ({
    ...prev,
    consulateAppointment: { countryId, city, datetime, notes: notes || '' }
  }));
}

export function clearAppointment() {
  state.update('user', prev => ({ ...prev, consulateAppointment: null }));
}

function findCentre(data, countryId) {
  if (!data?.centres) return null;
  return data.centres.find(c => c.countryId === countryId) || null;
}

export function exportAppointmentICS(appt, centre) {
  if (!appt || !centre) return;
  const ics = buildICS({
    uid: `consulate-${appt.countryId}-${appt.datetime}@discovereu-companion`,
    summary: `${t('consulate.icsSummary')} — ${centre.countryNameTr || centre.countryName}`,
    description: t('consulate.icsDesc'),
    location: `${centre.provider} — ${appt.city}`,
    startDate: new Date(appt.datetime),
    alarms: [
      { minutesBefore: 1440, description: t('consulate.alarm1') },
      { minutesBefore: 120,  description: t('consulate.alarm2') }
    ]
  });
  downloadICS(`consulate-${appt.datetime.slice(0, 10)}.ics`, ics);
}

/**
 * Render the 4th Turkish bonus card. Called from the existing
 * buildLayer() flow — caller should append the return value after
 * renderBudgetCard().
 */
export async function renderConsulateCard() {
  const data = await ensureConsulates();
  const appt = getAppointment();
  const card = h('section', { class: 'tr-card tr-card-consulate' }, [
    h('h3', null, `🏛️ ${t('consulate.title')}`)
  ]);

  if (!appt) {
    const addBtn = h('button', { class: 'btn btn-primary', type: 'button' }, `+ ${t('consulate.addCta')}`);
    on(addBtn, 'click', () => openConsulateForm(data));
    card.appendChild(h('p', { class: 'text-muted' }, t('consulate.empty')));
    card.appendChild(addBtn);
    return card;
  }

  const centre = findCentre(data, appt.countryId);
  const when = new Date(appt.datetime);
  const now = new Date();
  const diffMs = when - now;
  const days  = Math.max(0, Math.floor(diffMs / 86400000));
  const hours = Math.max(0, Math.floor((diffMs % 86400000) / 3600000));

  card.appendChild(h('p', { class: 'consulate-countdown' }, t('consulate.countdown', { days, hours })));
  card.appendChild(h('p', null, `📍 ${centre?.provider || ''} — ${appt.city}`));
  if (appt.notes) card.appendChild(h('p', { class: 'text-muted small' }, appt.notes));

  const actions = h('div', { class: 'tr-actions' }, [
    (() => {
      const a = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, `📅 ${t('consulate.addToCalendar')}`);
      on(a, 'click', () => exportAppointmentICS(appt, centre));
      return a;
    })(),
    (() => {
      const e = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `✏️ ${t('consulate.edit')}`);
      on(e, 'click', () => openConsulateForm(data, appt));
      return e;
    })(),
    (() => {
      const d = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `🗑 ${t('consulate.delete')}`);
      on(d, 'click', () => { if (confirm(t('consulate.confirmDelete'))) clearAppointment(); });
      return d;
    })()
  ]);
  card.appendChild(actions);
  return card;
}

function openConsulateForm(data, existing) {
  const overlay = h('div', { class: 'modal-overlay consulate-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const countrySelect = h('select', { class: 'input' },
    (data?.centres || []).map(c =>
      h('option', { value: c.countryId, ...(existing?.countryId === c.countryId ? { selected: 'selected' } : {}) },
        `${c.countryNameTr || c.countryName}`)
    )
  );
  const cityInput = h('input', { type: 'text', class: 'input', placeholder: 'Istanbul', value: existing?.city || '' });
  const dtInput = h('input', { type: 'datetime-local', class: 'input', value: existing?.datetime?.slice(0, 16) || '' });
  const notesInput = h('textarea', { class: 'input', rows: '3', placeholder: t('consulate.notesPlaceholder') }, existing?.notes || '');

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `🏛️ ${t('consulate.formTitle')}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      h('label', null, t('consulate.country')), countrySelect,
      h('label', null, t('consulate.city')),    cityInput,
      h('label', null, t('consulate.datetime')),dtInput,
      h('label', null, t('consulate.notes')),   notesInput,
      h('div', { class: 'modal-actions' }, [
        (() => {
          const b = h('button', { class: 'btn btn-primary', type: 'button' }, t('consulate.save'));
          on(b, 'click', () => {
            const countryId = countrySelect.value;
            const city = cityInput.value.trim();
            const datetime = dtInput.value;
            if (!countryId || !city || !datetime) return;
            saveAppointment({ countryId, city, datetime: new Date(datetime).toISOString(), notes: notesInput.value.trim() });
            close();
          });
          return b;
        })()
      ])
    ])
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);
}
