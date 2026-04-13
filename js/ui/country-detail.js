// js/ui/country-detail.js
// Renders the "Detail" tab of the side panel when a country is selected.
// Pure read from state — mutations happen via explicit buttons
// (add to route, focus on map) which dispatch back to state / map.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, escape } from '../utils/dom.js';
import { formatNumber } from '../utils/format.js';
import { getFeatureName } from '../map/countries-layer.js';
import { renderCountryGuideAccordion, renderCitiesAccordion, renderSharedMobilityAccordion } from './guide.js';
import { renderSoundtrackAccordion } from '../features/soundtrack.js';
import { renderCompactCard, openCrisisShield } from './crisis-shield-panel.js';
import { load as loadCrisisData } from '../features/crisis-shield.js';
import { getCitiesWithBuddies } from '../features/buddy.js';

const SCORE_KEYS = ['nature', 'culture', 'nightlife', 'food', 'history', 'safety'];

/**
 * Wire the detail tab. Subscribes to state so the panel auto-refreshes
 * whenever `selectedCountry`, `panelTab`, or `countries` change.
 *
 *   initCountryDetail();
 */
export function initCountryDetail() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    const tab = state.getSlice('panelTab');
    if (tab !== 'detail') return;
    const id = state.getSlice('selectedCountry');
    const country = id ? countryById(id) : null;
    renderInto(body, country, id);
  };

  state.subscribe('selectedCountry', render);
  state.subscribe('panelTab',        render);
  state.subscribe('countries',       render);
  state.subscribe('language',        render);

  render();
}

function renderInto(root, country, selectedId) {
  empty(root);

  if (!country) {
    if (selectedId) {
      // Country exists on the map but we haven't written its detail record yet.
      root.appendChild(renderMissing(selectedId));
    } else {
      root.appendChild(renderEmpty());
    }
    return;
  }

  root.appendChild(renderHeader(country));

  if (country.shortDescription) {
    root.appendChild(h('p', { class: 'country-desc' }, country.shortDescription));
  }

  root.appendChild(renderFacts(country));

  if (country.scores) {
    root.appendChild(renderScores(country.scores));
  }

  if (Array.isArray(country.highlights) && country.highlights.length) {
    root.appendChild(renderHighlights(country.highlights));
  }

  root.appendChild(renderActions(country));

  // Crisis Shield compact card — inserted right after weather/overview block
  // (renderActions closes the overview). Eagerly warms the crisis-data cache
  // so subsequent "Open full shield" clicks are instant. The compact card
  // owns its own "Open full shield" trigger which calls openCrisisShield().
  if (country.id) {
    loadCrisisData().catch(() => { /* non-fatal — compact card handles its own empty state */ });
    const crisisHost = h('div', { class: 'country-detail-crisis-host' });
    root.appendChild(crisisHost);
    try {
      renderCompactCard(crisisHost, country.id);
      // If the card chose not to render (no country match), drop the empty box.
      if (!crisisHost.childNodes.length) {
        crisisHost.remove();
      }
    } catch (_err) {
      // Panel module not yet available — degrade silently.
      crisisHost.remove();
    }
  }
  // Keep openCrisisShield import reachable for tree-shakers; it's the public
  // API that renderCompactCard dispatches into when its trigger is clicked.
  void openCrisisShield;

  // Buddy matching CTA — shown only if this country has at least one city
  // seeded in data/buddy-cities.json. The panel module is dynamically
  // imported on click so it stays out of the initial bundle.
  if (country.id) {
    const buddyHost = h('div', { class: 'country-detail-buddy-host' });
    root.appendChild(buddyHost);
    renderBuddyCta(buddyHost, country);
  }

  // Intercultural Coach CTA — shown for every country in data/countries.json.
  // Opens the full coach panel in a modal via dynamic import so coach-panel.js
  // (plus its LLM + quiz-runner deps) stays out of the initial bundle.
  if (country.id) {
    const coachHost = h('div', { class: 'country-detail-coach-host' });
    root.appendChild(coachHost);
    renderCoachCta(coachHost, country);
  }

  // Language Bridge CTA — shown for every country. Phrasebook tab is
  // offline-first; if the country is not in the seeded phrasebook list
  // the panel gracefully falls back via 404 handling. Panel module is
  // dynamically imported so tesseract/LLM deps stay out of the initial bundle.
  if (country.id) {
    const langHost = h('div', { class: 'country-detail-lang-host' });
    root.appendChild(langHost);
    renderLanguageBridgeCta(langHost, country);
  }

  // Country Guide + Top Cities accordions (from guide.js)
  const guideHost  = h('div', { class: 'country-detail-guide-host' });
  const citiesHost = h('div', { class: 'country-detail-cities-host' });
  root.appendChild(guideHost);
  root.appendChild(citiesHost);
  renderCountryGuideAccordion(guideHost, country.id);
  renderCitiesAccordion(citiesHost, country.id);
  // Shared Mobility accordion (E1) — slots between Transport (inside guide)
  // and Budget/Soundtrack sections.
  const mobilityHost = h('div', { class: 'country-detail-mobility-host' });
  root.appendChild(mobilityHost);
  renderSharedMobilityAccordion(mobilityHost, country.id);

  const soundtrackHost = h('div', { class: 'country-detail-soundtrack-host' });
  root.appendChild(soundtrackHost);
  renderSoundtrackAccordion(soundtrackHost, country.id);

  if (country.discoverEU === false) {
    root.appendChild(renderNonParticipatingWarning(country));
  }
}

function renderEmpty() {
  return h('div', { class: 'panel-empty' }, [
    h('p', null, t('panel.empty.message'))
  ]);
}

// Rendered when the user picks a country that is on the map but doesn't yet
// have a row in data/countries.json. Turns the gap into a contribution ask
// rather than a dead end.
function renderMissing(id) {
  const name = getFeatureName(id) || id;
  const issueUrl = `https://github.com/embeddedJedi/discovereu-companion/issues/new?title=${encodeURIComponent('Add country data: ' + name)}&labels=data,good-first-issue`;

  return h('div', { class: 'panel-missing' }, [
    h('h2', { class: 'country-name' }, name),
    h('p', { class: 'country-desc' }, t('detail.missing.message')),
    h('a', { class: 'btn btn-ghost', href: issueUrl, target: '_blank', rel: 'noopener' },
      t('detail.missing.contribute'))
  ]);
}

function renderHeader(country) {
  const title = h('div', { class: 'country-title' }, [
    h('span', { class: 'country-flag', 'aria-hidden': 'true' }, country.flag || ''),
    h('div', null, [
      h('h2', { class: 'country-name' }, country.name),
      country.nameLocal && country.nameLocal !== country.name
        ? h('div', { class: 'country-name-local' }, country.nameLocal)
        : null
    ])
  ]);

  const badges = h('div', { class: 'country-badges' }, [
    country.discoverEU
      ? h('span', { class: 'badge badge-accent' }, t('detail.badge.discoverEU'))
      : null,
    country.interrail
      ? h('span', { class: 'badge badge-soft' }, 'Interrail')
      : null,
    country.schengen
      ? h('span', { class: 'badge badge-soft' }, 'Schengen')
      : null,
    country.eu
      ? h('span', { class: 'badge badge-soft' }, 'EU')
      : null
  ]);

  return h('header', { class: 'country-header' }, [title, badges]);
}

function renderFacts(country) {
  const facts = [
    { label: t('detail.facts.capital'),   value: country.capital },
    { label: t('detail.facts.currency'),  value: country.currency },
    { label: t('detail.facts.languages'), value: (country.languages || []).join(', ').toUpperCase() },
    { label: t('detail.facts.population'),value: country.population ? formatNumber(country.population) : null },
    { label: t('detail.facts.calling'),   value: country.callingCode },
    { label: t('detail.facts.emergency'), value: country.emergency }
  ].filter(f => f.value);

  return h('dl', { class: 'country-facts' },
    facts.flatMap(f => [
      h('dt', null, f.label),
      h('dd', null, f.value)
    ])
  );
}

function renderScores(scores) {
  const items = SCORE_KEYS
    .filter(k => typeof scores[k] === 'number')
    .map(k => {
      const value = Math.max(0, Math.min(5, scores[k]));
      return h('div', { class: 'score-row' }, [
        h('span', { class: 'score-label' }, t(`detail.score.${k}`)),
        h('span', { class: 'score-bar', 'aria-hidden': 'true' }, [
          h('span', { class: 'score-bar-fill', style: { width: `${value * 20}%` } })
        ]),
        h('span', { class: 'score-value' }, `${value}/5`)
      ]);
    });

  if (!items.length) return document.createDocumentFragment();

  return h('section', { class: 'country-scores' }, [
    h('h3', null, t('detail.scores.title')),
    ...items
  ]);
}

function renderHighlights(highlights) {
  return h('section', { class: 'country-highlights' }, [
    h('h3', null, t('detail.highlights.title')),
    h('ul', null, highlights.map(x => h('li', null, x)))
  ]);
}

function renderActions(country) {
  const addBtn = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    'data-action': 'add-to-route',
    'data-country-id': country.id,
    disabled: country.discoverEU === false
  }, t('detail.action.addToRoute'));

  const compareBtn = h('button', {
    class: 'btn btn-ghost',
    type: 'button',
    'data-action': 'add-to-compare',
    'data-country-id': country.id
  }, t('detail.action.compare'));

  const wrapper = h('div', { class: 'country-actions' }, [addBtn, compareBtn]);

  addBtn.addEventListener('click', () => addCountryToRoute(country));
  compareBtn.addEventListener('click', () => toggleCompare(country));

  return wrapper;
}

function renderNonParticipatingWarning(country) {
  return h('div', { class: 'alert alert-warning', role: 'alert' },
    t('route.warnings.nonParticipating', { country: country.name })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Side-effect helpers — kept here so the detail tab is self-contained.
// ─────────────────────────────────────────────────────────────────────────────

function addCountryToRoute(country) {
  if (!country || country.discoverEU === false) return;
  state.update('route', r => {
    if (r.stops.some(s => s.countryId === country.id)) return r;  // no duplicates (for now)
    return {
      ...r,
      stops: [...r.stops, { countryId: country.id, cityId: null, nights: 2, arrivalDay: null, transport: 'train' }]
    };
  });
  state.set('panelTab', 'route');
}

function toggleCompare(country) {
  if (!country) return;
  state.update('compare', list => {
    const current = Array.isArray(list) ? list : [];
    if (current.includes(country.id)) {
      return current.filter(id => id !== country.id);
    }
    // Cap at 4 — drop the oldest if needed.
    const next = [...current, country.id];
    return next.length > 4 ? next.slice(next.length - 4) : next;
  });
  state.set('panelTab', 'compare');
}

// ─────────────────────────────────────────────────────────────────────────────
// Buddy Matching CTA — inline card rendered in the Detail tab.
// ─────────────────────────────────────────────────────────────────────────────

function renderBuddyCta(host, country) {
  getCitiesWithBuddies()
    .then(cities => {
      const matched = (cities || []).filter(c => c && c.countryId === country.id);
      if (!matched.length) return; // no buddy cities for this country — skip
      const firstCity = matched[0];
      const card = h('section', { class: 'buddy-cta-card' }, [
        h('div', { class: 'buddy-cta-head' }, [
          h('span', { class: 'buddy-cta-icon', 'aria-hidden': 'true' }, '🤝'),
          h('h3', { class: 'buddy-cta-title' }, t('buddy.panel.title'))
        ]),
        h('p', { class: 'buddy-cta-sub' }, t('buddy.panel.subtitle')),
        h('button', {
          class: 'btn btn-primary btn-sm',
          type: 'button',
          onclick: () => openBuddyPanelModal(firstCity.cityId)
        }, t('buddy.panel.pickCity'))
      ]);
      host.appendChild(card);
    })
    .catch(() => { /* non-fatal — skip card if seed fails */ });
}

function openBuddyPanelModal(initialCity) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('buddy.panel.title')
  });
  const box = h('div', { class: 'modal-box buddy-modal-box' });
  const closeBtn = h('button', {
    class: 'btn btn-ghost btn-sm modal-close',
    type: 'button',
    'aria-label': 'Close',
    onclick: () => backdrop.remove()
  }, '×');
  const content = h('div', { class: 'buddy-modal-content' });
  box.append(closeBtn, content);
  backdrop.appendChild(box);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);

  import('./buddy-panel.js')
    .then(mod => {
      if (typeof mod.renderBuddyPanel === 'function') {
        mod.renderBuddyPanel(content, { initialCity });
      }
    })
    .catch(err => {
      console.warn('[buddy] panel load failed', err);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Intercultural Coach CTA — inline card rendered in the Detail tab.
// ─────────────────────────────────────────────────────────────────────────────

function renderCoachCta(host, country) {
  if (!country || !country.id) return;
  const card = h('section', { class: 'coach-cta-card buddy-cta-card' }, [
    h('div', { class: 'buddy-cta-head' }, [
      h('span', { class: 'buddy-cta-icon', 'aria-hidden': 'true' }, '🎓'),
      h('h3', { class: 'buddy-cta-title' }, t('coach.panel.title'))
    ]),
    h('p', { class: 'buddy-cta-sub' }, t('coach.panel.description')),
    h('button', {
      class: 'btn btn-primary btn-sm',
      type: 'button',
      onclick: () => openCoachPanelModal(country.id)
    }, t('coach.panel.start'))
  ]);
  host.appendChild(card);
}

function openCoachPanelModal(countryId) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('coach.panel.title')
  });
  const box = h('div', { class: 'modal-box coach-modal-box' });
  const closeBtn = h('button', {
    class: 'btn btn-ghost btn-sm modal-close',
    type: 'button',
    'aria-label': t('coach.panel.close'),
    onclick: () => { try { cleanup?.(); } catch (_) {} backdrop.remove(); }
  }, '×');
  const content = h('div', { class: 'coach-modal-content' });
  box.append(closeBtn, content);
  backdrop.appendChild(box);
  let cleanup = null;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      try { cleanup?.(); } catch (_) {}
      backdrop.remove();
    }
  });
  document.body.appendChild(backdrop);

  import('./coach-panel.js')
    .then(mod => {
      if (typeof mod.renderCoachPanel === 'function') {
        cleanup = mod.renderCoachPanel(content, { countryId });
      }
    })
    .catch(err => {
      console.warn('[coach] panel load failed', err);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Bridge CTA — inline card rendered in the Detail tab.
// ─────────────────────────────────────────────────────────────────────────────

function renderLanguageBridgeCta(host, country) {
  if (!country || !country.id) return;
  const card = h('section', { class: 'lang-cta-card buddy-cta-card' }, [
    h('div', { class: 'buddy-cta-head' }, [
      h('span', { class: 'buddy-cta-icon', 'aria-hidden': 'true' }, '🌐'),
      h('h3', { class: 'buddy-cta-title' }, t('lang.panel.title'))
    ]),
    h('p', { class: 'buddy-cta-sub' },
      t('lang.panel.description', { country: country.name })
    ),
    h('button', {
      class: 'btn btn-primary btn-sm',
      type: 'button',
      onclick: () => openLanguageBridgeModal(country.id)
    }, t('lang.panel.open'))
  ]);
  host.appendChild(card);
}

function openLanguageBridgeModal(countryId) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('lang.panel.title')
  });
  const box = h('div', { class: 'modal-box lang-modal-box' });
  const closeBtn = h('button', {
    class: 'btn btn-ghost btn-sm modal-close',
    type: 'button',
    'aria-label': t('lang.panel.close'),
    onclick: () => { try { cleanup?.(); } catch (_) {} backdrop.remove(); }
  }, '×');
  const content = h('div', { class: 'lang-modal-content' });
  box.append(closeBtn, content);
  backdrop.appendChild(box);
  let cleanup = null;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      try { cleanup?.(); } catch (_) {}
      backdrop.remove();
    }
  });
  document.body.appendChild(backdrop);

  import('./language-bridge-panel.js')
    .then(mod => {
      if (typeof mod.renderLanguageBridgePanel === 'function') {
        cleanup = mod.renderLanguageBridgePanel(content, {
          countryId,
          initialTab: 'phrasebook'
        });
      }
    })
    .catch(err => {
      console.warn('[lang] panel load failed', err);
    });
}

// escape is imported above because a future version will accept raw HTML
// (e.g., localised rich descriptions). Keeping the import live prevents
// tree-shaking surprise later.
void escape;
