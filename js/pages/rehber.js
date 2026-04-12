// js/pages/rehber.js
// Ülke Rehberi — editorial travel magazine style guide page.
// Shows country hero cards → tap for full guide with cities, transport, culture.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let expandedCountry = null;
let searchQuery = '';
let unsubscribers = [];

export function mount(container) {
  containerEl = container;
  expandedCountry = null;
  searchQuery = '';
  render();
  unsubscribers.push(
    state.subscribe('countries', render),
    state.subscribe('language', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  expandedCountry = null;
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  if (expandedCountry) {
    renderCountryGuide();
  } else {
    renderCatalog();
  }
}

function renderCatalog() {
  const countries = (state.getSlice('countries') || [])
    .filter(c => !c.mapOnly)
    .sort((a, b) => a.name.localeCompare(b.name));

  const page = h('div', { class: 'rehber-page' });

  // Hero header
  page.appendChild(h('div', { class: 'rehber-hero' }, [
    h('h1', { class: 'rehber-title' }, t('rehber.pageTitle')),
    h('p', { class: 'rehber-subtitle' }, t('rehber.subtitle'))
  ]));

  // Search
  const searchInput = h('input', {
    type: 'search',
    class: 'rehber-search',
    placeholder: t('rehber.searchPlaceholder'),
    oninput: (ev) => {
      searchQuery = ev.target.value.toLowerCase();
      renderCards(grid, countries);
    }
  });
  page.appendChild(searchInput);

  // Country cards grid
  const grid = h('div', { class: 'rehber-grid' });
  renderCards(grid, countries);
  page.appendChild(grid);

  containerEl.appendChild(page);
}

function renderCards(grid, countries) {
  empty(grid);
  const filtered = searchQuery
    ? countries.filter(c => c.name.toLowerCase().includes(searchQuery))
    : countries;

  // Define gradient presets for visual variety
  const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
  ];

  filtered.forEach((country, i) => {
    const gradient = GRADIENTS[i % GRADIENTS.length];
    const topScore = getTopCategory(country);

    const card = h('button', {
      class: 'rehber-card',
      type: 'button',
      onclick: () => { expandedCountry = country.id; render(); }
    }, [
      h('div', { class: 'rehber-card-bg', style: { background: gradient } }),
      h('div', { class: 'rehber-card-content' }, [
        h('span', { class: 'rehber-card-flag' }, country.flag || country.id),
        h('h3', { class: 'rehber-card-name' }, country.name),
        h('div', { class: 'rehber-card-meta' }, [
          topScore ? h('span', { class: 'rehber-card-badge' }, topScore) : null,
          country.costPerDay
            ? h('span', { class: 'rehber-card-cost' }, `~\u20AC${country.costPerDay.low}/day`)
            : null
        ]),
        h('p', { class: 'rehber-card-desc' },
          (country.description || '').substring(0, 80) + (country.description?.length > 80 ? '\u2026' : ''))
      ])
    ]);
    grid.appendChild(card);
  });
}

function getTopCategory(country) {
  if (!country.scores) return null;
  const entries = Object.entries(country.scores);
  const top = entries.reduce((a, b) => b[1] > a[1] ? b : a);
  const labels = { nature: '\uD83C\uDF3F', culture: '\uD83C\uDFDB\uFE0F', nightlife: '\uD83C\uDF19', food: '\uD83C\uDF55', history: '\uD83D\uDCDC', safety: '\uD83D\uDEE1\uFE0F' };
  return top[1] >= 4 ? `${labels[top[0]] || ''} ${top[0]}` : null;
}

async function renderCountryGuide() {
  const country = countryById(expandedCountry);
  if (!country) { expandedCountry = null; render(); return; }

  const page = h('div', { class: 'rehber-detail' });

  // Back button
  page.appendChild(h('button', {
    class: 'rehber-back',
    type: 'button',
    onclick: () => { expandedCountry = null; render(); }
  }, [h('span', null, '\u2190'), h('span', null, t('rehber.backToAll'))]));

  // Country hero
  page.appendChild(h('div', { class: 'rehber-detail-hero' }, [
    h('span', { class: 'rehber-detail-flag' }, country.flag || country.id),
    h('h1', { class: 'rehber-detail-name' }, country.name),
    h('p', { class: 'rehber-detail-desc' }, country.description || ''),
    h('div', { class: 'rehber-detail-badges' }, [
      country.inDiscoverEU !== false ? h('span', { class: 'badge-pill badge-blue' }, 'DiscoverEU') : null,
      country.inInterrail !== false ? h('span', { class: 'badge-pill badge-gold' }, 'Interrail') : null,
      country.inSchengen !== false ? h('span', { class: 'badge-pill badge-green' }, 'Schengen') : null
    ])
  ]));

  // Quick facts grid
  const facts = [
    { icon: '\uD83C\uDFDB\uFE0F', label: t('rehber.capital'), value: country.capital },
    { icon: '\uD83D\uDCB6', label: t('rehber.currency'), value: country.currency },
    { icon: '\uD83D\uDDE3\uFE0F', label: t('rehber.languages'), value: Array.isArray(country.languages) ? country.languages.join(', ') : country.languages },
    { icon: '\uD83D\uDC65', label: t('rehber.population'), value: country.population?.toLocaleString() },
    { icon: '\uD83D\uDCDE', label: t('rehber.callingCode'), value: country.callingCode },
    { icon: '\uD83C\uDD98', label: t('rehber.emergency'), value: country.emergencyNumber || '112' }
  ].filter(f => f.value);

  page.appendChild(h('div', { class: 'rehber-facts-grid' },
    facts.map(f => h('div', { class: 'rehber-fact' }, [
      h('span', { class: 'rehber-fact-icon' }, f.icon),
      h('div', null, [
        h('div', { class: 'rehber-fact-label' }, f.label),
        h('div', { class: 'rehber-fact-value' }, f.value)
      ])
    ]))
  ));

  // Score bars
  if (country.scores) {
    const scoreSection = h('div', { class: 'rehber-scores' });
    scoreSection.appendChild(h('h2', { class: 'rehber-section-title' }, t('rehber.atAGlance')));
    const scoreIcons = { nature: '\uD83C\uDF3F', culture: '\uD83C\uDFDB\uFE0F', nightlife: '\uD83C\uDF19', food: '\uD83C\uDF55', history: '\uD83D\uDCDC', safety: '\uD83D\uDEE1\uFE0F' };
    Object.entries(country.scores).forEach(([key, val]) => {
      scoreSection.appendChild(h('div', { class: 'rehber-score-row' }, [
        h('span', { class: 'rehber-score-icon' }, scoreIcons[key] || ''),
        h('span', { class: 'rehber-score-label' }, key.charAt(0).toUpperCase() + key.slice(1)),
        h('div', { class: 'rehber-score-bar' }, [
          h('div', { class: 'rehber-score-fill', style: { width: `${(val / 5) * 100}%` } })
        ]),
        h('span', { class: 'rehber-score-val' }, `${val}/5`)
      ]));
    });
    page.appendChild(scoreSection);
  }

  // Highlights
  if (country.highlights?.length) {
    const hlSection = h('div', { class: 'rehber-highlights' });
    hlSection.appendChild(h('h2', { class: 'rehber-section-title' }, t('rehber.highlights')));
    const hlGrid = h('div', { class: 'rehber-hl-grid' });
    country.highlights.forEach((hl, i) => {
      hlGrid.appendChild(h('div', { class: 'rehber-hl-card' }, [
        h('span', { class: 'rehber-hl-num' }, String(i + 1)),
        h('span', null, hl)
      ]));
    });
    hlSection.appendChild(hlGrid);
    page.appendChild(hlSection);
  }

  // Guide accordion (lazy-load existing module)
  try {
    const { renderCountryGuideAccordion, renderCitiesAccordion } = await import('../ui/guide.js');
    const guideArea = h('div', { class: 'rehber-guide-sections' });
    guideArea.appendChild(h('h2', { class: 'rehber-section-title' }, t('rehber.travelGuide')));
    renderCountryGuideAccordion(guideArea, country.id);
    renderCitiesAccordion(guideArea, country.id);
    page.appendChild(guideArea);
  } catch (err) {
    console.warn('[rehber] guide module not available', err);
  }

  containerEl.appendChild(page);
}
