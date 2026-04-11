// js/ui/inclusion.js
// "Kapsayıcılık" tab — renders two views depending on whether a country
// is selected: the summary panorama (no selection) or a per-country
// breakdown (Rainbow + Accessibility + Emergency cards). Also exports
// activateFewerOpportunitiesMode() as the single source of truth for the
// preset logic (called from both this tab's button and the welcome
// wizard).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';
import {
  ensureInclusionData,
  getRainbowData,
  getAccessibilityData,
  getEmergencyInfo,
  inclusionSummaryStats
} from '../features/inclusion-data.js';
import { showToast } from './toast.js';

export function initInclusion() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = async () => {
    if (state.getSlice('panelTab') !== 'inclusion') return;
    await ensureInclusionData();
    renderInto(body);
  };

  state.subscribe('panelTab',         render);
  state.subscribe('selectedCountry',  render);
  state.subscribe('inclusionMode',    render);
  state.subscribe('countries',        render);
  state.subscribe('language',         render);

  render();
}

function renderInto(root) {
  empty(root);
  const selectedId = state.getSlice('selectedCountry');
  const panel = selectedId
    ? renderCountryView(selectedId)
    : renderSummaryView();
  root.appendChild(panel);
  wireActions(root);
}

// ─── Summary view ─────────────────────────────────────────────────────────

function renderSummaryView() {
  const stats = inclusionSummaryStats();
  const mode  = state.getSlice('inclusionMode');

  return h('div', { class: 'inclusion-panel' }, [
    h('header', { class: 'inclusion-header' }, [
      h('h2', null, t('inclusion.title')),
      h('p',  null, t('inclusion.subtitle'))
    ]),

    h('section', { class: 'inclusion-card inclusion-summary-card' }, [
      h('h3', null, `🌈 ${t('inclusion.summary.rainbowTitle')}`),
      h('p',  { class: 'inclusion-stat-big' }, `${stats.rainbowAverage} / 100`),
      h('p',  { class: 'inclusion-stat-caption' }, t('inclusion.summary.rainbowCaption', {
        marriage: stats.marriageEqualityCount,
        selfdet:  stats.selfDeterminationCount
      }))
    ]),

    h('section', { class: 'inclusion-card' }, [
      h('h3', null, `♿ ${t('inclusion.summary.accessTitle')}`),
      h('p',  null, t('inclusion.summary.accessStations', {
        n: stats.accessibleStationsCount,
        total: stats.totalCountries
      })),
      h('p',  null, t('inclusion.summary.accessDiscCard', {
        n: stats.disabilityCardCount
      }))
    ]),

    h('section', { class: 'inclusion-card' }, [
      h('h3', null, `🧭 ${t('inclusion.summary.mapModesTitle')}`),
      h('div', { class: 'inclusion-mode-chips', role: 'radiogroup', 'aria-label': 'Map colour mode' }, [
        renderModeChip('default',       mode, t('inclusion.mode.default')),
        renderModeChip('rainbow',       mode, '🌈 ' + t('inclusion.mode.rainbow')),
        renderModeChip('accessibility', mode, '♿ ' + t('inclusion.mode.accessibility'))
      ])
    ]),

    h('section', { class: 'inclusion-card inclusion-fewer-opps' }, [
      h('h3', null, `⚡ ${t('inclusion.summary.fewerOppsTitle')}`),
      h('p',  null, t('inclusion.summary.fewerOppsDesc')),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        'data-action': 'activate-fewer-opps'
      }, t('inclusion.summary.fewerOppsCta'))
    ]),

    h('p', { class: 'inclusion-hint' }, t('inclusion.summary.pickCountryHint'))
  ]);
}

function renderModeChip(value, current, label) {
  return h('button', {
    class: 'mode-chip' + (current === value ? ' is-active' : ''),
    type: 'button',
    role: 'radio',
    'aria-checked': current === value ? 'true' : 'false',
    'data-action': 'set-mode',
    'data-mode': value
  }, label);
}

// ─── Country view (stub — filled in Task 13) ─────────────────────────────

function renderCountryView(countryId) {
  // Filled in Task 13 — this stub returns a placeholder so the tab
  // renders instead of throwing when a country is selected.
  return h('div', { class: 'inclusion-panel' }, [
    h('p', null, `Loading country view for ${countryId}...`)
  ]);
}

// ─── Actions ──────────────────────────────────────────────────────────────

function wireActions(panel) {
  on(panel, 'click', '[data-action="set-mode"]', (_ev, target) => {
    state.set('inclusionMode', target.dataset.mode);
  });
  on(panel, 'click', '[data-action="activate-fewer-opps"]', () => {
    activateFewerOpportunitiesMode();
  });
}

// ─── Exported: Fewer-opportunities preset (single source of truth) ────────

export function activateFewerOpportunitiesMode() {
  state.update('filters', f => ({
    ...f,
    budget:        'low',
    accessibility: true,
    lgbtqSafe:     true,
    interrailOnly: true
  }));
  showToast(t('inclusion.fewerOppsEnabled'), 'success', 5000);
  state.set('panelTab', 'filters');
}
