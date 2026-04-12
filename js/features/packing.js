// js/features/packing.js
// Smart Packing Assistant — weather-aware, route-adaptive, 5 categories.
//
// Exports:
//   buildPackingList(route, user, weather)  — pure; returns { categories: [...] }
//   fetchForecasts(stops)                   — async; Open-Meteo + 6h cache
//   mount(container)                        — renders UI into a DOM container
//
// Data flow:
//   route/user/prep  ─┐
//                     ├─►  buildPackingList()  ─►  render()
//   weather (async) ──┘

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty, on } from '../utils/dom.js';
import { cache } from '../utils/storage.js';

// ─── Capital lat/lng (mirrors co2.js; kept inline for zero cross-feature coupling) ──
const CAPITAL_LATLNG = {
  AL: [41.33,  19.82], AT: [48.21,  16.37], BA: [43.87,  18.42], BE: [50.85,   4.35],
  BG: [42.70,  23.32], CH: [46.95,   7.45], CY: [35.17,  33.37], CZ: [50.08,  14.43],
  DE: [52.52,  13.40], DK: [55.68,  12.57], EE: [59.44,  24.75], ES: [40.42,  -3.70],
  FI: [60.17,  24.94], FR: [48.85,   2.35], GR: [37.98,  23.73], HR: [45.81,  15.98],
  HU: [47.50,  19.04], IE: [53.35,  -6.26], IS: [64.14, -21.94], IT: [41.90,  12.48],
  LI: [47.14,   9.52], LT: [54.69,  25.28], LU: [49.61,   6.13], LV: [56.95,  24.11],
  MK: [41.99,  21.43], MT: [35.90,  14.51], NL: [52.37,   4.89], NO: [59.91,  10.75],
  PL: [52.23,  21.01], PT: [38.72,  -9.14], RO: [44.43,  26.10], RS: [44.79,  20.45],
  SE: [59.33,  18.07], SI: [46.06,  14.51], SK: [48.15,  17.11], TR: [41.01,  28.98]
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// ─── Static catalogues ──────────────────────────────────────────────────

// Five categories, 5-8 base items each. All source:'base'.
const BASE_CATEGORIES = [
  {
    id: 'essentials',
    items: ['daypack', 'comfyShoes', 'waterBottle', 'cashCard', 'offlinePack', 'reusableBag']
  },
  {
    id: 'clothing',
    items: ['tshirts', 'underwearSocks', 'sleepwear', 'lightJacket', 'comfyPants']
  },
  {
    id: 'electronics',
    items: ['phoneCharger', 'powerBank', 'adapter', 'earphones']
  },
  {
    id: 'documents',
    items: ['discoverEUPass', 'passportCopy', 'ehicCard', 'insuranceDoc', 'emergencyCard']
  },
  {
    id: 'health',
    items: ['basicMeds', 'toiletries', 'handSanitiser', 'tissues']
  }
];

// Route-adaptive rules. source:'route'.
const ROUTE_RULES = [
  { test: c => (c.scores?.beach ?? 0) >= 4,
    items: [['clothing','swimsuit'], ['clothing','flipFlops'], ['health','sunscreen'], ['clothing','sunglasses']] },
  { test: c => ['IS','NO','FI','SE','EE','LV','LT'].includes(c.id),
    items: [['clothing','warmJacket'], ['clothing','thermals'], ['clothing','beanieGloves']] },
  { test: c => (c.scores?.nature ?? 0) >= 4,
    items: [['clothing','rainJacket'], ['clothing','hikingShoes']] },
  { test: c => (c.scores?.culture ?? 0) >= 4 || (c.scores?.nightlife ?? 0) >= 4,
    items: [['clothing','niceOutfit']] }
];

const CAMP_ITEMS = [['essentials','sleepingBag'], ['essentials','headlamp'], ['essentials','dryBag']];

// Weather thresholds — evaluated over ALL stops' 7-day forecasts.
// If ANY stop crosses a threshold, the corresponding items are added.
const WEATHER_RULES = [
  { id: 'rainy', test: w => w.maxRainProb >= 40,
    items: [['clothing','rainJacket'], ['essentials','umbrella']] },
  { id: 'cold', test: w => w.minTempMax < 10,
    items: [['clothing','warmLayers'], ['clothing','beanie'], ['clothing','gloves']] },
  { id: 'hot', test: w => w.maxTemp > 28,
    items: [['health','sunscreen'], ['clothing','sunHat'], ['essentials','extraWater']] }
];

// ─── Pure: buildPackingList ─────────────────────────────────────────────

/**
 * Build the categorised packing list.
 *   route:   state.route
 *   user:    state.user
 *   weather: { maxTemp, minTempMax, maxRainProb } | null
 *   custom:  state.prep.packingCustom []
 *   done:    state.prep.packingDone {}
 *
 * Returns { categories: [{ id, name, items: [{ id, label, packed, source }] }] }.
 */
export function buildPackingList(route, user, weather, custom = [], done = {}) {
  // One map<catId, map<itemId, source>> to de-duplicate & track origin.
  const buckets = new Map();
  for (const cat of BASE_CATEGORIES) {
    buckets.set(cat.id, new Map());
    for (const id of cat.items) buckets.get(cat.id).set(id, 'base');
  }

  // Route rules
  const stops = route?.stops || [];
  const countries = stops.map(s => countryById(s.countryId)).filter(Boolean);
  for (const rule of ROUTE_RULES) {
    if (countries.some(rule.test)) {
      for (const [catId, itemId] of rule.items) addItem(buckets, catId, itemId, 'route');
    }
  }
  if (user?.accommodation === 'camp') {
    for (const [catId, itemId] of CAMP_ITEMS) addItem(buckets, catId, itemId, 'route');
  }

  // Weather rules
  if (weather && typeof weather === 'object') {
    for (const rule of WEATHER_RULES) {
      try {
        if (rule.test(weather)) {
          for (const [catId, itemId] of rule.items) addItem(buckets, catId, itemId, 'weather');
        }
      } catch (_) { /* missing weather field — ignore */ }
    }
  }

  // Custom items
  for (const c of custom) {
    if (!c || !c.id) continue;
    const catId = buckets.has(c.category) ? c.category : 'essentials';
    buckets.get(catId).set(c.id, 'custom');
  }

  const categories = BASE_CATEGORIES.map(cat => ({
    id: cat.id,
    name: t(`packing.category.${cat.id}`),
    items: [...buckets.get(cat.id).entries()].map(([id, source]) => ({
      id,
      label: source === 'custom'
        ? (custom.find(c => c.id === id)?.label || id)
        : t(`packing.item.${id}`),
      packed: !!done[id],
      source
    }))
  }));

  return { categories };
}

function addItem(buckets, catId, itemId, source) {
  if (!buckets.has(catId)) buckets.set(catId, new Map());
  const m = buckets.get(catId);
  // Don't downgrade a stronger source.
  if (!m.has(itemId)) m.set(itemId, source);
}

// ─── Weather fetch ──────────────────────────────────────────────────────

/**
 * Fetch Open-Meteo 7-day forecasts for every stop's capital.
 * Returns a single aggregated object:
 *   { maxTemp, minTempMax, maxRainProb, perStop: [{ countryId, ... }] }
 * Falls back to null on total failure (caller treats as "no weather data").
 */
export async function fetchForecasts(stops) {
  const uniqueIds = [...new Set((stops || []).map(s => s.countryId))].filter(Boolean);
  if (!uniqueIds.length) return null;

  const results = await Promise.allSettled(
    uniqueIds.map(id => fetchOne(id))
  );

  const perStop = [];
  let maxTemp = -Infinity, minTempMax = Infinity, maxRainProb = 0;
  let anySuccess = false;

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    anySuccess = true;
    perStop.push(r.value);
    if (typeof r.value.maxTemp === 'number') maxTemp = Math.max(maxTemp, r.value.maxTemp);
    if (typeof r.value.minTempMax === 'number') minTempMax = Math.min(minTempMax, r.value.minTempMax);
    if (typeof r.value.maxRainProb === 'number') maxRainProb = Math.max(maxRainProb, r.value.maxRainProb);
  }

  if (!anySuccess) return null;
  return {
    maxTemp: Number.isFinite(maxTemp) ? maxTemp : null,
    minTempMax: Number.isFinite(minTempMax) ? minTempMax : null,
    maxRainProb,
    perStop
  };
}

async function fetchOne(countryId) {
  const coords = CAPITAL_LATLNG[countryId];
  if (!coords) return null;
  const [lat, lng] = coords;
  const key = `packing-forecast-${lat}-${lng}`;

  const cached = cache.get(key, SIX_HOURS_MS);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + `&daily=temperature_2m_max,precipitation_probability_max&forecast_days=7&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();
    const temps = json?.daily?.temperature_2m_max || [];
    const rains = json?.daily?.precipitation_probability_max || [];
    const summary = {
      countryId,
      maxTemp: temps.length ? Math.max(...temps) : null,
      minTempMax: temps.length ? Math.min(...temps) : null,
      maxRainProb: rains.length ? Math.max(...rains.filter(x => x != null)) : 0
    };
    cache.set(key, summary);
    return summary;
  } catch (err) {
    console.warn('[packing] forecast fetch failed for', countryId, err);
    return null;
  }
}

// ─── Mount / render ─────────────────────────────────────────────────────

let weatherCache = null;       // last-fetched aggregated weather, reused across renders
let weatherPromise = null;     // in-flight fetch de-dupe
let lastStopsKey = '';         // '|AT|FR' — triggers refetch when route changes

export function mount(container) {
  if (!container) return () => {};
  render(container);

  const rerender = () => render(container);
  const unsubs = [
    state.subscribe('prep',      rerender),
    state.subscribe('user',      rerender),
    state.subscribe('route',     rerender),
    state.subscribe('countries', rerender),
    state.subscribe('language',  rerender)
  ];

  return () => unsubs.forEach(fn => fn());
}

function render(container) {
  empty(container);

  const prep  = state.getSlice('prep')  || {};
  const route = state.getSlice('route');
  const user  = state.getSlice('user');

  // Kick off weather fetch if the route changed.
  const stopsKey = (route?.stops || []).map(s => s.countryId).join('|');
  if (stopsKey && stopsKey !== lastStopsKey && !weatherPromise) {
    lastStopsKey = stopsKey;
    weatherPromise = fetchForecasts(route.stops)
      .then(w => { weatherCache = w; weatherPromise = null; render(container); })
      .catch(_ => { weatherPromise = null; });
  } else if (!stopsKey) {
    weatherCache = null;
    lastStopsKey = '';
  }

  const list = buildPackingList(
    route, user, weatherCache,
    prep.packingCustom || [], prep.packingDone || {}
  );

  const totalCount = list.categories.reduce((n, c) => n + c.items.length, 0);
  const packedCount = list.categories.reduce(
    (n, c) => n + c.items.filter(i => i.packed).length, 0);
  const pct = totalCount ? Math.round((packedCount / totalCount) * 100) : 0;
  const complete = totalCount > 0 && packedCount === totalCount;

  const section = h('section', {
    class: 'prep-section packing-section' + (complete ? ' packing-complete' : '')
  });

  // Header + progress
  section.appendChild(h('div', { class: 'prep-section-head' }, [
    h('h3', { class: 'prep-section-title' }, t('prep.packingTitle')),
    h('span', { class: 'prep-pill' }, `${packedCount} / ${totalCount}`)
  ]));

  section.appendChild(h('div', {
    class: 'packing-progress',
    role: 'progressbar',
    'aria-valuenow': String(pct),
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-label': t('packing.progressLabel')
  }, [
    h('div', { class: 'packing-progress-bar', style: { width: `${pct}%` } })
  ]));

  section.appendChild(h('p', { class: 'route-section-sub' }, t('prep.packingSub')));

  // Weather badge (if available)
  if (weatherCache) {
    section.appendChild(renderWeatherBadge(weatherCache));
  }

  // Celebration banner
  if (complete) {
    section.appendChild(h('div', {
      class: 'packing-celebration',
      role: 'status',
      'aria-live': 'polite'
    }, t('packing.allPacked')));
  }

  // Categories
  for (const cat of list.categories) {
    section.appendChild(renderCategory(cat));
  }

  // Custom item input
  section.appendChild(renderCustomForm());

  container.appendChild(section);
  wireActions(section);
}

function renderWeatherBadge(w) {
  const parts = [];
  if (typeof w.maxTemp === 'number') parts.push(`↑ ${Math.round(w.maxTemp)}°C`);
  if (typeof w.minTempMax === 'number') parts.push(`↓ ${Math.round(w.minTempMax)}°C`);
  if (typeof w.maxRainProb === 'number') parts.push(`☂ ${Math.round(w.maxRainProb)}%`);
  return h('div', { class: 'packing-weather-badge', 'aria-live': 'polite' }, [
    h('span', { class: 'packing-weather-label' }, t('packing.weatherLabel')),
    h('span', { class: 'packing-weather-values' }, parts.join('  ·  '))
  ]);
}

function renderCategory(cat) {
  return h('div', { class: 'packing-category' }, [
    h('h4', { class: 'packing-category-title' }, cat.name),
    h('ul', { class: 'prep-list prep-list-grid' },
      cat.items.map(item => renderItem(cat.id, item)))
  ]);
}

function renderItem(catId, item) {
  const badgeClass = {
    weather: 'packing-badge packing-badge-weather',
    route:   'packing-badge packing-badge-route',
    custom:  'packing-badge packing-badge-custom'
  }[item.source];

  const badgeLabel = {
    weather: t('packing.badge.weather'),
    route:   t('packing.badge.route'),
    custom:  t('packing.badge.custom')
  }[item.source];

  return h('li', { class: 'prep-row packing-row' }, [
    h('label', { class: 'prep-row-label' }, [
      h('input', {
        type: 'checkbox',
        class: 'prep-check',
        'data-action': 'toggle-pack',
        'data-item-id': item.id,
        ...(item.packed ? { checked: '' } : {})
      }),
      h('span', { class: 'prep-row-text' }, item.label),
      badgeClass ? h('span', { class: badgeClass, title: badgeLabel }, badgeLabel) : null
    ]),
    item.source === 'custom'
      ? h('button', {
          type: 'button',
          class: 'packing-remove',
          'data-action': 'remove-custom',
          'data-item-id': item.id,
          'aria-label': t('packing.remove')
        }, '×')
      : null
  ]);
}

function renderCustomForm() {
  return h('form', { class: 'packing-custom-form', 'data-action': 'add-custom' }, [
    h('input', {
      type: 'text',
      class: 'input packing-custom-input',
      name: 'label',
      placeholder: t('packing.customPlaceholder'),
      'aria-label': t('packing.customPlaceholder'),
      maxlength: '60'
    }),
    h('select', { class: 'input packing-custom-select', name: 'category' },
      BASE_CATEGORIES.map(c =>
        h('option', { value: c.id }, t(`packing.category.${c.id}`)))
    ),
    h('button', { type: 'submit', class: 'btn btn-secondary' }, t('packing.addItem'))
  ]);
}

// ─── Actions ───────────────────────────────────────────────────────────

function wireActions(root) {
  on(root, 'change', '[data-action="toggle-pack"]', (_ev, target) => {
    const id = target.dataset.itemId;
    state.update('prep', p => ({
      ...p,
      packingDone: { ...(p?.packingDone || {}), [id]: target.checked }
    }));
  });

  on(root, 'click', '[data-action="remove-custom"]', (_ev, target) => {
    const id = target.dataset.itemId;
    state.update('prep', p => ({
      ...p,
      packingCustom: (p?.packingCustom || []).filter(c => c.id !== id),
      packingDone: stripKey(p?.packingDone || {}, id)
    }));
  });

  on(root, 'submit', 'form[data-action="add-custom"]', (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const label = (form.label?.value || '').trim();
    const category = form.category?.value || 'essentials';
    if (!label) return;
    const id = 'custom-' + Date.now().toString(36) + '-'
      + Math.random().toString(36).slice(2, 6);
    state.update('prep', p => ({
      ...p,
      packingCustom: [...(p?.packingCustom || []), { id, label, category }]
    }));
    form.reset();
  });
}

function stripKey(obj, key) {
  const next = { ...obj };
  delete next[key];
  return next;
}
