// js/pages/coach.js
// v1.6 — Standalone /coach page.
//
// Two modes:
//   1. No countryId  → render a picker grid of all DiscoverEU countries;
//                      clicking one updates the hash to #/coach?country=XX
//                      (or #/coach/XX) and re-mounts in lesson mode.
//   2. With countryId → mount the full Coach panel via dynamic import of
//                      js/ui/coach-panel.js into the page container.
//
// The panel itself handles missing LLM key, offline, and language changes —
// this wrapper stays thin. countryId is read from:
//   - the hash sub-segment (#/coach/DE)  ← preferred, clean URL
//   - or the query param  (#/coach?country=DE)
//   - or location.search  (?country=DE)

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';
import { navigate } from '../router.js';

let panelCleanup = null;
let unsubLang = null;
let mountEl = null;

function readCountryIdFromLocation() {
  // Hash forms supported:
  //   #/coach/DE
  //   #/coach?country=DE
  //   #/coach/DE?country=XX  (sub-segment wins)
  const raw = (location.hash || '').replace(/^#\/?/, '');
  // Strip "coach" prefix
  if (!raw.startsWith('coach')) return null;
  let rest = raw.slice('coach'.length);
  if (rest.startsWith('/')) rest = rest.slice(1);
  if (!rest) return null;

  // Split query
  const qIdx = rest.indexOf('?');
  const path = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
  const query = qIdx >= 0 ? rest.slice(qIdx + 1) : '';

  if (path) return path.toUpperCase();
  if (query) {
    const params = new URLSearchParams(query);
    const c = params.get('country');
    if (c) return c.toUpperCase();
  }
  // Fallback to document-level search
  if (location.search) {
    const c = new URLSearchParams(location.search).get('country');
    if (c) return c.toUpperCase();
  }
  return null;
}

function disposePanel() {
  try { if (typeof panelCleanup === 'function') panelCleanup(); } catch (_) { /* noop */ }
  panelCleanup = null;
}

function renderPicker(container) {
  empty(container);

  const countries = (state.getSlice('countries') || [])
    .filter(c => c && c.discoverEU !== false)
    .slice()
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

  const header = h('header', { class: 'coach-page__header' }, [
    h('h1', { class: 'coach-page__title' }, t('coach.page.title')),
    h('p', { class: 'coach-page__hint' }, t('coach.page.pickCountryHint'))
  ]);

  const grid = h('ul', {
    class: 'coach-page__picker-grid',
    role: 'list',
    'aria-label': t('coach.page.pickCountry')
  });

  const coach = state.getSlice('coach') || {};
  const earned = new Set((coach.badgesEarned || []).map(b => b.countryId));

  countries.forEach(c => {
    const btn = h('button', {
      type: 'button',
      class: 'coach-page__pick-btn',
      'data-country-id': c.id,
      'aria-label': c.name || c.id
    }, [
      h('span', { class: 'coach-page__pick-flag', 'aria-hidden': 'true' }, c.flag || '🇪🇺'),
      h('span', { class: 'coach-page__pick-name' }, c.name || c.id),
      earned.has(c.id)
        ? h('span', { class: 'coach-page__pick-badge', 'aria-label': t('coach.badge.earned') }, '🎓')
        : null
    ]);
    btn.addEventListener('click', () => navigate('coach', c.id));
    grid.appendChild(h('li', null, btn));
  });

  const section = h('section', { class: 'coach-page coach-page--picker' }, [
    header,
    grid
  ]);
  container.appendChild(section);
}

async function renderLesson(container, countryId) {
  empty(container);

  const back = h('button', {
    type: 'button',
    class: 'btn btn-ghost coach-page__back'
  }, '← ' + t('coach.page.pickCountry'));
  back.addEventListener('click', () => navigate('coach'));

  const host = h('div', { class: 'coach-page__panel-host' });

  const wrap = h('section', { class: 'coach-page coach-page--lesson' }, [
    back,
    host
  ]);
  container.appendChild(wrap);

  try {
    const mod = await import('../ui/coach-panel.js');
    if (typeof mod.renderCoachPanel === 'function') {
      panelCleanup = mod.renderCoachPanel(host, { countryId });
    }
  } catch (err) {
    console.warn('[coach-page] panel load failed', err);
    host.appendChild(h('p', { class: 'coach-page__error', role: 'alert' },
      t('coach.errors.generic')));
  }
}

function renderCurrent() {
  if (!mountEl) return;
  disposePanel();
  const id = readCountryIdFromLocation();
  if (id) {
    renderLesson(mountEl, id);
  } else {
    renderPicker(mountEl);
  }
}

export async function mount(container) {
  if (!container) return;
  mountEl = container;
  container.classList.add('coach-page-host');

  // Re-render on hashchange so in-page navigation between picker ↔ lesson works.
  window.addEventListener('hashchange', renderCurrent);

  // Re-render on language change (picker labels; panel handles its own).
  unsubLang = state.subscribe('language', () => {
    // If we're in picker mode, a full re-render is needed. In lesson mode
    // the panel already subscribes to language itself, so leave it alone.
    if (!readCountryIdFromLocation()) renderPicker(mountEl);
  });

  renderCurrent();
}

export function unmount() {
  disposePanel();
  window.removeEventListener('hashchange', renderCurrent);
  try { if (typeof unsubLang === 'function') unsubLang(); } catch (_) { /* noop */ }
  unsubLang = null;
  mountEl = null;
}
