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
import { getCountryGuide, listCitiesForCountry, getCityGuide } from '../data/loader.js';

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
    buildCountrySections(guide),
    h('footer', { class: 'guide-footer' }, [
      h('span', null, `${t('guide.lastUpdated', { date: guide.lastUpdated })} · `),
      h('a', { href: guide.sourceUrl, target: '_blank', rel: 'noopener' }, t('guide.source'))
    ])
  ]);
  container.appendChild(details);
}

function buildCountrySections(guide) {
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
    wrap.appendChild(h('section', { class: 'guide-sect' }, [
      h('h4', null, `${emoji} ${t(i18nKey)}`),
      h('p', null, text)
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

  return h('details', { class: 'guide-city', open: false }, [
    h('summary', null, `📍 ${name} · ${city.minDays}d · ${bestMonths}`),
    h('div', { class: 'guide-city-body' }, [
      h('p', null, pick(city, 'summary')),
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

function section(emoji, i18nKey, items) {
  if (!items || items.length === 0) return null;
  const lis = items.map(x => typeof x === 'string' ? h('li', null, x) : x);
  return h('section', { class: 'guide-city-sect' }, [
    h('h5', null, `${emoji} ${t(i18nKey)}`),
    h('ul', null, lis)
  ]);
}
