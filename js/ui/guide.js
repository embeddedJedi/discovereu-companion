// js/ui/guide.js
// Lazy-rendered accordion blocks for the Country Detail tab:
//   renderCountryGuideAccordion — 10 sub-sections from guides.json.countries[id]
//   renderCitiesAccordion       — top N cities for the country
//   renderCityGuide             — single-city panel (reused by both callers)
// All three use <details>/<summary> so keyboard + screen reader support
// comes for free.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';
import { getCountryGuide, listCitiesForCountry, getCityGuide, getSharedMobilityForCountry } from '../data/loader.js';
import { refreshCountry } from '../features/wikivoyage-refresh.js';
import { renderSafetyCallout as renderPickpocketCallout } from '../features/pickpocket.js';
import { showToast } from './toast.js';

function useTr() { return state.getSlice('language') === 'tr'; }
function pick(obj, key) { return useTr() ? (obj[key + 'Tr'] ?? obj[key]) : obj[key]; }

export async function renderCountryGuideAccordion(container, countryId) {
  empty(container);
  const guide = await getCountryGuide(countryId);
  if (!guide) {
    container.appendChild(h('p', { class: 'text-muted' }, t('guide.missing')));
    return;
  }
  const details = h('details', { class: 'guide-accordion', open: false }, [
    h('summary', null, [
      h('span', null, `🗺️ ${t('guide.countryTitle')}`),
      h('span', { class: 'chevron' }, '▾')
    ]),
    buildCountrySections(guide, countryId),
    h('footer', { class: 'guide-footer' }, [
      h('span', null, `${t('guide.lastUpdated', { date: guide.lastUpdated })} · `),
      h('a', { href: guide.sourceUrl, target: '_blank', rel: 'noopener' }, t('guide.source'))
    ])
  ]);
  container.appendChild(details);
}

function buildCountrySections(guide, countryId) {
  const wrap = h('div', { class: 'guide-sections' });
  const sections = [
    ['summary',       '📘', 'guide.section.summary'],
    ['whenToGo',      '📅', 'guide.section.whenToGo'],
    ['whatToEat',     '🍽️', 'guide.section.whatToEat'],
    ['transport',     '🚆', 'guide.section.transport'],
    ['money',         '💶', 'guide.section.money'],
    ['etiquette',     '🤝', 'guide.section.etiquette'],
    ['safety',        '🛟', 'guide.section.safety'],
    ['connectivity',  '📶', 'guide.section.connectivity']
  ];
  for (const [key, emoji, i18nKey] of sections) {
    const text = pick(guide, key);
    if (!text) continue;
    const title = guide.sourceUrl?.split('/').pop();
    const body = h('div', { class: 'guide-sect-body' }, [h('p', null, text)]);
    const caption = h('p', { class: 'guide-sect-caption text-muted small', hidden: true });
    const refreshBtn = h('button', {
      class: 'guide-refresh-btn',
      type: 'button',
      'aria-label': t('wikivoyage.refresh'),
      title: t('wikivoyage.refresh'),
      onclick: (ev) => handleRefresh(ev.currentTarget, countryId, key, body, caption, title)
    }, [h('span', { 'aria-hidden': 'true' }, '↻')]);
    wrap.appendChild(h('section', { class: 'guide-sect' }, [
      h('header', { class: 'guide-sect-header' }, [
        h('h4', null, `${emoji} ${t(i18nKey)}`),
        refreshBtn
      ]),
      body,
      caption
    ]));
  }
  // Language basics
  const basics = useTr() ? guide.languageBasicsTr : guide.languageBasics;
  if (Array.isArray(basics) && basics.length) {
    wrap.appendChild(h('section', { class: 'guide-sect guide-basics' }, [
      h('h4', null, `🗣️ ${t('guide.section.languageBasics')}`),
      h('ul', null, basics.map(b => h('li', null, [
        h('strong', null, b.phrase),
        ` — ${b.meaning}`
      ])))
    ]));
  }
  // Pitfalls
  const pitfalls = useTr() ? guide.avoidPitfallsTr : guide.avoidPitfalls;
  if (Array.isArray(pitfalls) && pitfalls.length) {
    wrap.appendChild(h('section', { class: 'guide-sect guide-pitfalls' }, [
      h('h4', null, `⚠️ ${t('guide.section.avoidPitfalls')}`),
      h('ul', null, pitfalls.map(p => h('li', null, p)))
    ]));
  }
  return wrap;
}

export async function renderCitiesAccordion(container, countryId) {
  empty(container);
  const cities = await listCitiesForCountry(countryId);
  if (!cities.length) return;
  const outer = h('details', { class: 'guide-accordion guide-cities', open: false }, [
    h('summary', null, [
      h('span', null, `🏙️ ${t('guide.topCitiesTitle', { n: cities.length })}`),
      h('span', { class: 'chevron' }, '▾')
    ])
  ]);
  for (const city of cities) {
    outer.appendChild(buildCityDetails(city));
  }
  container.appendChild(outer);
}

function buildCityDetails(city) {
  const must = useTr() ? city.mustSeeTr : city.mustSee;
  const eat  = useTr() ? city.mustEatTr : city.mustEat;
  const free = useTr() ? city.freeStuffTr : city.freeStuff;
  const avoid= useTr() ? city.avoidTouristTr : city.avoidTourist;
  const name = useTr() ? city.nameTr : city.name;
  const bestMonths = useTr() ? city.bestMonthsTr : city.bestMonths;

  const safetyHost = h('div', { class: 'guide-city-safety-host' });
  // Kick off the async render; appends card when data is ready.
  renderPickpocketCallout(city.id, safetyHost).catch(() => {});

  return h('details', { class: 'guide-city', open: false }, [
    h('summary', null, `📍 ${name} · ${city.minDays}d · ${bestMonths}`),
    h('div', { class: 'guide-city-body' }, [
      h('p', null, pick(city, 'summary')),
      safetyHost,
      h('div', { class: 'guide-city-budget' }, [
        h('span', null, `💶 €${city.budgetPerDayEUR.low}–${city.budgetPerDayEUR.high}/day`)
      ]),
      section('👀', 'guide.city.mustSee', must && must.map(m => h('li', null, [
        h('strong', null, m.name),
        m.tip ? ` — ${m.tip}` : null
      ]))),
      section('🍝', 'guide.city.mustEat', eat),
      section('💸', 'guide.city.free',   free),
      section('🚇', 'guide.city.transport', [h('li', null, pick(city, 'localTransport'))]),
      section('🛟', 'guide.city.safety', [h('li', null, pick(city, 'safety'))]),
      section('🚫', 'guide.city.avoid',  avoid)
    ])
  ]);
}

async function handleRefresh(btn, countryId, sectionKey, bodyEl, captionEl, title) {
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  btn.classList.add('is-loading');
  const snapshot = Array.from(bodyEl.childNodes).map(n => n.cloneNode(true));
  try {
    const result = await refreshCountry(countryId, sectionKey, { title });
    if (!result?.html) throw new Error('empty');
    // html is pre-sanitized in wikivoyage-refresh.js (sanitizeHtml)
    empty(bodyEl);
    const tmpl = document.createElement('template');
    tmpl.innerHTML = result.html;
    bodyEl.appendChild(tmpl.content);
    const when = new Date(result.updated).toISOString().slice(0, 10);
    captionEl.hidden = false;
    empty(captionEl);
    captionEl.appendChild(document.createTextNode(t('wikivoyage.updatedFromWikivoyage', { date: when }) + ' · '));
    captionEl.appendChild(h('a', { href: result.source, target: '_blank', rel: 'noopener noreferrer' }, t('wikivoyage.sourceLabel')));
    showToast(t('wikivoyage.refreshSuccess'), 'success');
  } catch (err) {
    console.warn('[wikivoyage] refresh failed', err);
    empty(bodyEl);
    snapshot.forEach(n => bodyEl.appendChild(n));
    showToast(t('wikivoyage.refreshFailed'), 'error');
  } finally {
    btn.setAttribute('aria-busy', 'false');
    btn.classList.remove('is-loading');
  }
}

function section(emoji, i18nKey, items) {
  if (!items || items.length === 0) return null;
  const lis = items.map(x => typeof x === 'string' ? h('li', null, x) : x);
  return h('section', { class: 'guide-city-sect' }, [
    h('h5', null, `${emoji} ${t(i18nKey)}`),
    h('ul', null, lis)
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Mobility accordion (E1)
// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loads data/shared-mobility.json and renders country-level ridesharing
// info plus per-city expandable panels (scooters, bikes, car-sharing,
// ride-hailing, price range, tips). Intended to slot between the Transport
// accordion (inside country guide) and the Budget tab.

export async function renderSharedMobilityAccordion(container, countryId) {
  empty(container);
  let data;
  try {
    data = await getSharedMobilityForCountry(countryId);
  } catch (err) {
    console.warn('[guide] shared-mobility load failed', err);
    data = { country: null, cities: [] };
  }

  const hasCountry = data.country && (data.country.ridesharing || data.country.carpooling);
  const hasCities = Array.isArray(data.cities) && data.cities.length > 0;

  const details = h('details', { class: 'guide-accordion guide-mobility', open: false }, [
    h('summary', null, [
      h('span', null, `🛴 ${t('sharedMobility.title')}`),
      h('span', { class: 'chevron' }, '▾')
    ])
  ]);

  if (!hasCountry && !hasCities) {
    details.appendChild(h('div', { class: 'guide-sect guide-mobility-empty' }, [
      h('p', null, t('sharedMobility.noData')),
      h('a', {
        href: 'https://github.com/embeddedJedi/discovereu-companion/blob/main/data/shared-mobility.json',
        target: '_blank', rel: 'noopener'
      }, t('sharedMobility.contribute'))
    ]));
    container.appendChild(details);
    return;
  }

  // Country-level block
  if (hasCountry) {
    const c = data.country;
    const countrySect = h('section', { class: 'guide-sect guide-mobility-country' });
    if (c.ridesharing && Array.isArray(c.ridesharing.platforms) && c.ridesharing.platforms.length) {
      countrySect.appendChild(h('h4', null, `🚗 ${t('sharedMobility.ridesharing')}`));
      countrySect.appendChild(h('p', null, c.ridesharing.platforms.join(', ')));
      if (c.ridesharing.notes) {
        countrySect.appendChild(h('p', { class: 'text-muted' }, c.ridesharing.notes));
      }
    }
    if (c.carpooling && Array.isArray(c.carpooling.platforms) && c.carpooling.platforms.length) {
      countrySect.appendChild(h('h4', null, `👥 ${t('sharedMobility.carpooling')}`));
      countrySect.appendChild(h('p', null, c.carpooling.platforms.join(', ')));
    }
    details.appendChild(countrySect);
  }

  // Per-city expandables
  if (hasCities) {
    const citiesWrap = h('div', { class: 'guide-mobility-cities' });
    for (const city of data.cities) {
      citiesWrap.appendChild(buildCityMobility(city));
    }
    details.appendChild(citiesWrap);
  }

  container.appendChild(details);
}

function buildCityMobility(city) {
  const name = useTr() ? (city.nameTr ?? city.name ?? city.id) : (city.name ?? city.id);
  const body = h('div', { class: 'guide-city-body' });

  const list = (emoji, key, items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    body.appendChild(h('section', { class: 'guide-city-sect' }, [
      h('h5', null, `${emoji} ${t(key)}`),
      h('ul', null, items.map(i => h('li', null, i)))
    ]));
  };

  list('🛴', 'sharedMobility.scooters',    city.scooters);
  list('🚲', 'sharedMobility.bikes',       city.bikes);
  list('🚗', 'sharedMobility.carSharing',  city.carSharing);
  list('🚕', 'sharedMobility.rideHailing', city.rideHailing);

  if (city.priceRange) {
    body.appendChild(h('p', null, [h('strong', null, `💶 ${t('sharedMobility.priceRange')}: `), city.priceRange]));
  }
  if (city.tips) {
    body.appendChild(h('p', null, [h('strong', null, `💡 ${t('sharedMobility.tips')}: `), city.tips]));
  }

  return h('details', { class: 'guide-city', open: false }, [
    h('summary', null, `📍 ${name}`),
    body
  ]);
}
