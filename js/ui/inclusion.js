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

// ─── Country view ─────────────────────────────────────────────────────────

function renderCountryView(countryId) {
  const country = countryById(countryId);
  if (!country) {
    return h('div', { class: 'inclusion-panel' }, [
      h('p', null, t('inclusion.country.notFound'))
    ]);
  }

  const rd = getRainbowData(countryId);
  const ad = getAccessibilityData(countryId);
  const ei = getEmergencyInfo(countryId, state.getSlice('language'));
  const useTr = state.getSlice('language') === 'tr';

  return h('div', { class: 'inclusion-panel' }, [
    h('header', { class: 'inclusion-header' }, [
      h('h2', null, `${country.flag || ''} ${country.name}`),
      h('p',  null, t('inclusion.country.subtitle'))
    ]),
    rd ? renderRainbowCard(rd, useTr)       : renderMissingCard('rainbow'),
    ad ? renderAccessibilityCard(ad, useTr) : renderMissingCard('accessibility'),
    ei ? renderEmergencyCard(ei, useTr)     : renderMissingCard('emergency')
  ]);
}

function renderRainbowCard(rd, useTr) {
  const cats = [
    { id: 'equality',          icon: '⚖️' },
    { id: 'family',            icon: '👪' },
    { id: 'hateCrime',         icon: '🛡️' },
    { id: 'legalGenderRecog',  icon: '🆔' },
    { id: 'intersexIntegrity', icon: '🩺' },
    { id: 'civilSociety',      icon: '📣' },
    { id: 'asylum',            icon: '🏛️' }
  ];
  return h('section', { class: 'inclusion-card rainbow-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '🌈 ILGA Rainbow Europe'),
      rd.ilgaRank != null
        ? h('span', { class: 'badge badge-soft' }, `#${rd.ilgaRank}`)
        : null,
      h('span', { class: 'inclusion-big-score' }, `${rd.overallScore ?? '—'}/100`)
    ]),
    h('div', { class: 'rainbow-categories' },
      cats.map(cat => {
        const c = rd.categories?.[cat.id];
        if (!c) return null;
        return h('div', { class: 'rainbow-category' }, [
          h('span', { class: 'rainbow-cat-label' }, `${cat.icon} ${t('inclusion.rainbow.cat.' + cat.id)}`),
          h('div', { class: 'progress progress-sm', role: 'progressbar',
                     'aria-valuenow': String(c.score), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
            h('div', { class: 'progress-bar', style: { width: `${c.score}%` } })
          ]),
          h('span', { class: 'rainbow-cat-score' }, `${c.score}%`)
        ]);
      })
    ),
    rd.keyItems ? h('ul', { class: 'key-items' },
      Object.entries(rd.keyItems).map(([k, v]) => h('li', { class: 'key-item ' + (v === true ? 'ok' : v === 'partial' ? 'partial' : 'no') }, [
        h('span', { class: 'key-icon' }, v === true ? '✓' : v === 'partial' ? '◐' : '✗'),
        h('span', null, t('inclusion.rainbow.keyItem.' + k))
      ]))
    ) : null,
    rd.highlight ? h('p', { class: 'rainbow-highlight' }, `💬 ${useTr && rd.highlightTr ? rd.highlightTr : rd.highlight}`) : null,
    h('p', { class: 'inclusion-source' }, `${t('inclusion.source')}: ILGA-Europe 2025${rd.lastUpdated ? ' · ' + rd.lastUpdated : ''}`)
  ]);
}

function renderAccessibilityCard(ad, useTr) {
  const sections = [
    { id: 'publicTransport',  icon: '🚇' },
    { id: 'trainStations',    icon: '🚆' },
    { id: 'accommodation',    icon: '🏨' },
    { id: 'attractions',      icon: '🏛️' }
  ];
  return h('section', { class: 'inclusion-card access-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '♿ ' + t('inclusion.access.title')),
      h('span', { class: 'inclusion-big-score' }, `${ad.overallScore ?? '—'}/5`)
    ]),
    h('div', { class: 'access-sections' },
      sections.map(s => {
        const data = ad[s.id];
        if (!data) return null;
        const pct = Math.round(((data.score || 0) / 5) * 100);
        return h('div', { class: 'access-section' }, [
          h('span', { class: 'access-label' }, `${s.icon} ${t('inclusion.access.section.' + s.id)}`),
          h('div', { class: 'progress progress-sm', role: 'progressbar',
                     'aria-valuenow': String(data.score), 'aria-valuemin': '0', 'aria-valuemax': '5' }, [
            h('div', { class: 'progress-bar', style: { width: `${pct}%` } })
          ]),
          h('span', { class: 'access-score' }, `${data.score}/5`)
        ]);
      })
    ),
    ad.disabilityCard ? h('div', { class: 'access-meta' }, [
      h('p', null, `🎫 ${ad.disabilityCard.euDisabilityCardAccepted ? t('inclusion.access.euCardYes') : t('inclusion.access.euCardNo')}`),
      ad.disabilityCard.nationalCard ? h('p', null, `${t('inclusion.access.nationalCard')}: ${ad.disabilityCard.nationalCard}`) : null,
      ad.disabilityCard.typicalDiscount ? h('p', null, `${t('inclusion.access.discount')}: ${ad.disabilityCard.typicalDiscount}`) : null
    ]) : null,
    Array.isArray(ad.topCities) && ad.topCities.length > 0 ? h('div', { class: 'access-cities' }, [
      h('p', { class: 'access-cities-title' }, `📍 ${t('inclusion.access.topCities')}`),
      h('ul', null, ad.topCities.map(c => h('li', null, `${c.city}: ${c.accessibleSpots.toLocaleString()}`)))
    ]) : null,
    ad.trainStations?.assistanceBooking?.available ? h('div', { class: 'access-assist' }, [
      h('p', null, `📞 ${t('inclusion.access.assistanceBooking')}`),
      h('a', { href: `tel:${ad.trainStations.assistanceBooking.phone}` }, ad.trainStations.assistanceBooking.phone),
      h('p', { class: 'access-lead' }, t('inclusion.access.leadTimeHours', { n: ad.trainStations.assistanceBooking.leadTimeHours }))
    ]) : null,
    h('p', { class: 'inclusion-source' }, `${t('inclusion.source')}: Wheelmap.org · ${ad.lastUpdated || ''}`)
  ]);
}

function renderEmergencyCard(ei, useTr) {
  const country = ei.country;
  if (!country) return null;
  const primaryLang = country.primaryLanguages?.[0];
  const localPhrases = country.phrases?.[primaryLang] || {};
  const phraseKeys = ['help','callPolice','callAmbulance','whereIsHospital','doYouSpeakEnglish'];
  const userFallback = ei.globalPhrases?.[ei.userLang] || ei.globalPhrases?.en || {};

  return h('section', { class: 'inclusion-card emergency-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '📞 ' + t('inclusion.emergency.title'))
    ]),
    h('div', { class: 'emergency-numbers' }, [
      h('p', { class: 'emergency-universal' }, [
        h('strong', null, '🇪🇺 '),
        h('span', null, `${t('inclusion.emergency.eu')}: `),
        h('a', { href: `tel:${ei.universal?.number}` }, ei.universal?.number || '112')
      ]),
      h('dl', { class: 'emergency-local' }, [
        h('dt', null, t('inclusion.emergency.police')),    h('dd', null, h('a', { href: `tel:${country.numbers?.police}` }, country.numbers?.police || '—')),
        h('dt', null, t('inclusion.emergency.ambulance')), h('dd', null, h('a', { href: `tel:${country.numbers?.ambulance}` }, country.numbers?.ambulance || '—')),
        h('dt', null, t('inclusion.emergency.fire')),      h('dd', null, h('a', { href: `tel:${country.numbers?.fire}` }, country.numbers?.fire || '—'))
      ])
    ]),
    h('div', { class: 'emergency-phrases' }, [
      h('p', { class: 'emergency-phrases-title' }, `💬 ${t('inclusion.emergency.phrasesTitle')} (${primaryLang?.toUpperCase()})`),
      h('ul', null, phraseKeys.map(key => {
        const local = localPhrases[key] || '—';
        const userTxt = userFallback[key] || '';
        return h('li', { class: 'phrase-row' }, [
          h('div', { class: 'phrase-user' }, userTxt),
          h('div', { class: 'phrase-local' }, local),
          h('button', {
            class: 'btn btn-ghost btn-sm',
            type: 'button',
            'data-action': 'show-phrase',
            'data-phrase': local
          }, '📱')
        ]);
      }))
    ]),
    country.embassyHint?.tr ? h('p', { class: 'emergency-embassy' }, `🇹🇷 ${country.embassyHint.tr}`) : null
  ]);
}

function renderMissingCard(kind) {
  return h('section', { class: 'inclusion-card inclusion-missing' }, [
    h('p', null, t('inclusion.missing.' + kind))
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
  on(panel, 'click', '[data-action="show-phrase"]', (_ev, target) => {
    showPhraseModal(target.dataset.phrase || '');
  });
}

function showPhraseModal(phrase) {
  const overlay = h('div', { class: 'modal-overlay phrase-modal-overlay', 'data-modal': 'phrase' }, [
    h('div', { class: 'modal modal-phrase', role: 'dialog', 'aria-modal': 'true' }, [
      h('p', { class: 'phrase-text' }, phrase),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        'data-action': 'close-phrase-modal'
      }, '×')
    ])
  ]);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
  overlay.querySelector('[data-action="close-phrase-modal"]').addEventListener('click', close);
  document.addEventListener('keydown', function handler(ev) {
    if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
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

export { renderInto as renderInclusionPanel, renderCountryView as renderInclusionSummary };
