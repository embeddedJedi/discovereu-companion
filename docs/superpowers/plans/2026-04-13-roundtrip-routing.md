# Round-Trip Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add home-city-anchored round-trip routing with directional arrows on the map and AI that plans both legs.

**Architecture:** Extend `state.user` with `homeCity`, `state.route` with `returnStops` + `includeReturnInBudget`. New `js/map/route-layer.js` owns all route rendering using Leaflet + PolylineDecorator CDN (dashed polylines + repeating arrowheads, different color/dash for outbound vs return). Budget/credits/CO₂ modules compute over an `effectiveLegs` array that includes the return when the toggle is on. AI adapters extend `routeSchema` with `returnLeg`, and the AI modal gets a "Dönüşü optimize et" action.

**Tech Stack:** Vanilla ES modules, Leaflet, `leaflet-polylinedecorator@1.6.0` CDN, LocalStorage/IndexedDB, Playwright MCP for smoke verification (no test runner in project).

**Testing note:** Project has no unit-test runner. Each task ends with either (a) a browser-console assertion block to paste in DevTools or (b) a Playwright MCP smoke verified via screenshot. Frequent commits after each task.

**Spec:** [`docs/superpowers/specs/2026-04-13-roundtrip-routing-design.md`](../specs/2026-04-13-roundtrip-routing-design.md)

**Safety note on DOM:** The project uses an `h()` helper (`js/utils/dom.js`) for all DOM construction — never use innerHTML with interpolated data. Leaflet's `L.divIcon({ html })` is the one exception and may only receive STATIC strings or values already coerced to numbers/known letters (not user input).

---

## Task 1: State shape + TR city data

**Files:**
- Modify: `js/state.js` (initialState.user, initialState.route, migration)
- Modify: `data/countries.json` (ensure TR has cities[])

- [ ] **Step 1: Inspect current TR entry in `data/countries.json`**

Run:
```bash
grep -n '"TR"\|"tr"' data/countries.json | head
```
If `cities` array missing or has <4 entries, continue to Step 2; else skip to Step 3.

- [ ] **Step 2: Add TR cities if missing**

In `data/countries.json` under the TR country object, ensure:
```json
"cities": [
  { "id": "ist", "name": "İstanbul", "lat": 41.0082, "lng": 28.9784 },
  { "id": "ank", "name": "Ankara",   "lat": 39.9334, "lng": 32.8597 },
  { "id": "izm", "name": "İzmir",    "lat": 38.4237, "lng": 27.1428 },
  { "id": "esb", "name": "Eskişehir","lat": 39.7767, "lng": 30.5206 }
]
```

- [ ] **Step 3: Extend `state.js` initialState.user**

Add `homeCity: 'ist'` beside `homeCountry: 'TR'`:
```js
user: {
  groupSize: 4,
  homeCountry: 'TR',
  homeCity: 'ist',
  budget: 'moderate',
  ...
}
```

- [ ] **Step 4: Extend `state.js` initialState.route**

```js
route: {
  stops: [],
  returnStops: [],
  includeReturnInBudget: true,
  travelDaysLimit: 7,
  seatCreditsLimit: 4,
  name: ''
}
```

- [ ] **Step 5: Add migration for persisted state**

In `state.js`, after reading persisted state from storage and before merging into initialState, add:
```js
function migrate(persisted) {
  if (persisted?.user && !persisted.user.homeCity) {
    persisted.user.homeCity = 'ist';
  }
  if (persisted?.route) {
    if (!Array.isArray(persisted.route.returnStops)) persisted.route.returnStops = [];
    if (typeof persisted.route.includeReturnInBudget !== 'boolean') persisted.route.includeReturnInBudget = true;
  }
  return persisted;
}
```
Call `migrate(...)` on the persisted payload before `Object.assign(state, persisted)` (or equivalent merge path — match the existing pattern in `state.js`).

- [ ] **Step 6: Browser smoke**

Open `index.html`, in DevTools console:
```js
const s = JSON.parse(localStorage.getItem('discovereu_state'));
console.assert(s.user.homeCity, 'homeCity missing');
console.assert(Array.isArray(s.route.returnStops), 'returnStops missing');
console.assert(s.route.includeReturnInBudget === true, 'toggle default wrong');
console.log('OK', s.user.homeCity, s.route.returnStops.length, s.route.includeReturnInBudget);
```
Expected: `OK ist 0 true`.

- [ ] **Step 7: Commit**

```bash
git add js/state.js data/countries.json
git commit -m "feat(v1.2): state shape for round-trip routing — homeCity, returnStops, budget toggle"
```

---

## Task 2: i18n strings

**Files:**
- Modify: `i18n/en.json`, `i18n/tr.json`, `i18n/de.json`, `i18n/fr.json`, `i18n/es.json`, `i18n/it.json`

- [ ] **Step 1: Define English source strings in `i18n/en.json`** (under a new `route.return` namespace; match the existing file's nesting style):

```json
"route.return.sectionTitle": "Return",
"route.return.toggleLabel": "Include return in budget & seat credits",
"route.return.directHint": "Direct return to home",
"route.return.addStop": "Add return stop",
"route.return.homeCard": "Home: {city}",
"route.return.optimizeBtn": "Optimize return with AI",
"route.home.chip": "Home: {city}",
"route.home.edit": "Change",
"route.home.modalTitle": "Your home city",
"route.home.country": "Country",
"route.home.city": "City",
"route.home.save": "Save",
"wizard.home.title": "Where do you live?",
"wizard.home.hint": "We use this to plan your return journey.",
"ai.return.optimizing": "Planning your return…",
"ai.return.accept": "Use this return",
"ai.return.reject": "Keep current return"
```

- [ ] **Step 2: Turkish translations in `i18n/tr.json`**

```json
"route.return.sectionTitle": "Dönüş",
"route.return.toggleLabel": "Dönüşü bütçe ve seat credit'lere dahil et",
"route.return.directHint": "Doğrudan eve dönüş",
"route.return.addStop": "Dönüş durağı ekle",
"route.return.homeCard": "Ev: {city}",
"route.return.optimizeBtn": "Dönüşü AI ile optimize et",
"route.home.chip": "Ev: {city}",
"route.home.edit": "Değiştir",
"route.home.modalTitle": "Ev şehriniz",
"route.home.country": "Ülke",
"route.home.city": "Şehir",
"route.home.save": "Kaydet",
"wizard.home.title": "Nerede yaşıyorsun?",
"wizard.home.hint": "Dönüş yolculuğunu planlamak için kullanıyoruz.",
"ai.return.optimizing": "Dönüş planlanıyor…",
"ai.return.accept": "Bu dönüşü kullan",
"ai.return.reject": "Mevcut dönüşü tut"
```

- [ ] **Step 3: DE translations in `i18n/de.json`**

```json
"route.return.sectionTitle": "Rückreise",
"route.return.toggleLabel": "Rückreise in Budget und Sitzplatzreservierungen einbeziehen",
"route.return.directHint": "Direkte Rückreise",
"route.return.addStop": "Zwischenstopp hinzufügen",
"route.return.homeCard": "Zuhause: {city}",
"route.return.optimizeBtn": "Rückreise mit KI optimieren",
"route.home.chip": "Zuhause: {city}",
"route.home.edit": "Ändern",
"route.home.modalTitle": "Deine Heimatstadt",
"route.home.country": "Land",
"route.home.city": "Stadt",
"route.home.save": "Speichern",
"wizard.home.title": "Wo wohnst du?",
"wizard.home.hint": "Wir nutzen das für deine Rückreise.",
"ai.return.optimizing": "Rückreise wird geplant…",
"ai.return.accept": "Diese Rückreise nutzen",
"ai.return.reject": "Aktuelle Rückreise behalten"
```

- [ ] **Step 4: FR translations in `i18n/fr.json`**

```json
"route.return.sectionTitle": "Retour",
"route.return.toggleLabel": "Inclure le retour dans le budget et les crédits de réservation",
"route.return.directHint": "Retour direct à la maison",
"route.return.addStop": "Ajouter une étape retour",
"route.return.homeCard": "Maison : {city}",
"route.return.optimizeBtn": "Optimiser le retour avec l'IA",
"route.home.chip": "Maison : {city}",
"route.home.edit": "Modifier",
"route.home.modalTitle": "Ta ville de résidence",
"route.home.country": "Pays",
"route.home.city": "Ville",
"route.home.save": "Enregistrer",
"wizard.home.title": "Où habites-tu ?",
"wizard.home.hint": "Pour planifier ton voyage retour.",
"ai.return.optimizing": "Planification du retour…",
"ai.return.accept": "Utiliser ce retour",
"ai.return.reject": "Garder le retour actuel"
```

- [ ] **Step 5: ES translations in `i18n/es.json`**

```json
"route.return.sectionTitle": "Regreso",
"route.return.toggleLabel": "Incluir regreso en presupuesto y reservas",
"route.return.directHint": "Regreso directo a casa",
"route.return.addStop": "Añadir parada de regreso",
"route.return.homeCard": "Casa: {city}",
"route.return.optimizeBtn": "Optimizar regreso con IA",
"route.home.chip": "Casa: {city}",
"route.home.edit": "Cambiar",
"route.home.modalTitle": "Tu ciudad de origen",
"route.home.country": "País",
"route.home.city": "Ciudad",
"route.home.save": "Guardar",
"wizard.home.title": "¿Dónde vives?",
"wizard.home.hint": "Lo usamos para planear tu regreso.",
"ai.return.optimizing": "Planeando el regreso…",
"ai.return.accept": "Usar este regreso",
"ai.return.reject": "Mantener el regreso actual"
```

- [ ] **Step 6: IT translations in `i18n/it.json`**

```json
"route.return.sectionTitle": "Ritorno",
"route.return.toggleLabel": "Includi il ritorno in budget e prenotazioni",
"route.return.directHint": "Ritorno diretto a casa",
"route.return.addStop": "Aggiungi tappa di ritorno",
"route.return.homeCard": "Casa: {city}",
"route.return.optimizeBtn": "Ottimizza il ritorno con l'IA",
"route.home.chip": "Casa: {city}",
"route.home.edit": "Modifica",
"route.home.modalTitle": "La tua città",
"route.home.country": "Paese",
"route.home.city": "Città",
"route.home.save": "Salva",
"wizard.home.title": "Dove vivi?",
"wizard.home.hint": "Lo usiamo per pianificare il ritorno.",
"ai.return.optimizing": "Pianificazione del ritorno…",
"ai.return.accept": "Usa questo ritorno",
"ai.return.reject": "Mantieni il ritorno attuale"
```

- [ ] **Step 7: Smoke**

Open app, switch between all 6 languages, confirm none of the new keys show as raw `route.return.sectionTitle` in console.

- [ ] **Step 8: Commit**

```bash
git add i18n/
git commit -m "feat(v1.2): i18n strings for round-trip routing (en/tr/de/fr/es/it)"
```

---

## Task 3: Home city picker (shared component)

**Files:**
- Create: `js/ui/home-city-picker.js`

- [ ] **Step 1: Write the picker module**

Create `js/ui/home-city-picker.js`:
```js
// js/ui/home-city-picker.js
// Shared country+city picker. Used by welcome-wizard and route-builder.
import { h } from '../utils/dom.js';
import { state } from '../state.js';
import { t } from '../i18n.js';

/**
 * Render a country + city select pair into `container`.
 * Calls onChange({ countryId, cityId }) whenever either changes.
 */
export function renderHomeCityPicker(container, { countryId, cityId, onChange }) {
  const countries = state.getSlice('countries') || [];
  let current = { countryId: countryId || 'TR', cityId };

  const citySelect = h('select', { 'aria-label': t('route.home.city') });
  const countrySelect = h('select', { 'aria-label': t('route.home.country') },
    countries.map(c => h('option', { value: c.id, selected: c.id === current.countryId }, c.name || c.id))
  );

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderCities() {
    const country = countries.find(c => c.id === current.countryId);
    const cities = country?.cities || [];
    clearNode(citySelect);
    cities.forEach(city => {
      const opt = h('option', { value: city.id, selected: city.id === current.cityId }, city.name);
      citySelect.appendChild(opt);
    });
    if (!cities.find(c => c.id === current.cityId)) {
      current.cityId = cities[0]?.id;
    }
  }

  countrySelect.addEventListener('change', () => {
    current.countryId = countrySelect.value;
    renderCities();
    onChange({ ...current });
  });
  citySelect.addEventListener('change', () => {
    current.cityId = citySelect.value;
    onChange({ ...current });
  });

  renderCities();
  clearNode(container);
  container.append(
    h('label', {}, t('route.home.country')), countrySelect,
    h('label', {}, t('route.home.city')), citySelect
  );
  return () => ({ ...current });
}

/**
 * Resolve { lat, lng, name, countryId, cityId } for the user's home city.
 * Falls back to the first city in homeCountry if the stored homeCity is missing.
 */
export function resolveHomeCoords() {
  const { homeCountry, homeCity } = state.getSlice('user');
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === homeCountry);
  if (!country) return null;
  const city = (country.cities || []).find(c => c.id === homeCity) || country.cities?.[0];
  if (!city) return null;
  return { lat: city.lat, lng: city.lng, name: city.name, countryId: country.id, cityId: city.id };
}
```

- [ ] **Step 2: Smoke**

In DevTools after app loads:
```js
import('./js/ui/home-city-picker.js').then(m => {
  const coords = m.resolveHomeCoords();
  console.assert(coords && coords.lat && coords.lng, 'resolveHomeCoords failed');
  console.log('HOME', coords);
});
```
Expected: `HOME {lat: 41.0082, lng: 28.9784, name: "İstanbul", ...}`.

- [ ] **Step 3: Commit**

```bash
git add js/ui/home-city-picker.js
git commit -m "feat(v1.2): shared home-city picker component + resolveHomeCoords helper"
```

---

## Task 4: Welcome wizard home-city step

**Files:**
- Modify: `js/ui/welcome-wizard.js`

- [ ] **Step 1: Locate wizard steps array**

```bash
grep -n "steps\|renderStep\|language\|groupSize" js/ui/welcome-wizard.js | head -20
```
Identify where steps are listed. Insert the home-city step AFTER the language step and BEFORE the group-size step.

- [ ] **Step 2: Add home step**

Import at the top of `welcome-wizard.js`:
```js
import { renderHomeCityPicker } from './home-city-picker.js';
```

In the steps definition, add:
```js
{
  id: 'home',
  title: () => t('wizard.home.title'),
  render: (container) => {
    const hint = h('p', { class: 'wizard-hint' }, t('wizard.home.hint'));
    const pickerBox = h('div', { class: 'wizard-home-picker' });
    container.append(hint, pickerBox);
    const user = state.getSlice('user');
    renderHomeCityPicker(pickerBox, {
      countryId: user.homeCountry,
      cityId: user.homeCity,
      onChange: ({ countryId, cityId }) => {
        state.update('user', u => ({ ...u, homeCountry: countryId, homeCity: cityId }));
      }
    });
  }
}
```

- [ ] **Step 3: Smoke with Playwright MCP**

- Clear localStorage (`localStorage.clear(); location.reload()`).
- Walk through wizard. Screenshot home step.
- Finish wizard, verify `state.user.homeCity` is persisted.

- [ ] **Step 4: Commit**

```bash
git add js/ui/welcome-wizard.js
git commit -m "feat(v1.2): welcome wizard — home city step"
```

---

## Task 5: Route builder home chip + return section

**Files:**
- Modify: `js/ui/route-builder.js`
- Modify: the existing route-builder stylesheet (find with `ls css/`)

- [ ] **Step 1: Identify route-builder render entry**

```bash
grep -n "export\|render\|function" js/ui/route-builder.js | head -20
```
Find the main render function.

- [ ] **Step 2: Add home chip at top of route builder**

In the main render, prepend:
```js
function renderHomeChip() {
  const home = resolveHomeCoords();
  const label = home ? t('route.home.chip', { city: home.name }) : t('route.home.modalTitle');
  const chip = h('button', {
    class: 'home-chip',
    type: 'button',
    'aria-label': t('route.home.edit'),
    onclick: () => openHomeModal()
  }, ['🏠 ', label, ' ', h('span', { class: 'home-chip-edit' }, t('route.home.edit'))]);
  return chip;
}
```

Add `openHomeModal`:
```js
function openHomeModal() {
  const backdrop = h('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' });
  const box = h('div', { class: 'modal-box' });
  const title = h('h2', {}, t('route.home.modalTitle'));
  const pickerBox = h('div');
  const user = state.getSlice('user');
  let pending = { countryId: user.homeCountry, cityId: user.homeCity };
  renderHomeCityPicker(pickerBox, {
    countryId: pending.countryId, cityId: pending.cityId,
    onChange: p => { pending = p; }
  });
  const save = h('button', {
    class: 'btn-primary',
    onclick: () => {
      state.update('user', u => ({ ...u, homeCountry: pending.countryId, homeCity: pending.cityId }));
      backdrop.remove();
    }
  }, t('route.home.save'));
  box.append(title, pickerBox, save);
  backdrop.append(box);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
```

- [ ] **Step 3: Add return section below outbound stops**

```js
function renderReturnSection() {
  const route = state.getSlice('route');
  const home = resolveHomeCoords();
  const section = h('section', { class: 'route-return-section', 'aria-label': t('route.return.sectionTitle') });
  section.append(h('h3', {}, t('route.return.sectionTitle')));

  const toggle = h('label', { class: 'toggle-row' }, [
    h('input', {
      type: 'checkbox',
      role: 'switch',
      checked: route.includeReturnInBudget,
      'aria-checked': String(route.includeReturnInBudget),
      onchange: e => state.update('route', r => ({ ...r, includeReturnInBudget: e.target.checked }))
    }),
    h('span', {}, t('route.return.toggleLabel'))
  ]);
  section.append(toggle);

  // Return stops list — reuse the outbound stop editor. `renderStopEditor`
  // is the existing component; pass custom update/remove callbacks that
  // write into `returnStops` instead of `stops`.
  const list = h('div', { class: 'return-stops-list' });
  (route.returnStops || []).forEach((stop, i) => {
    list.append(renderStopEditor(stop, i, {
      onUpdate: (next) => state.update('route', r => {
        const arr = [...r.returnStops];
        arr[i] = next;
        return { ...r, returnStops: arr };
      }),
      onRemove: () => state.update('route', r => {
        const arr = r.returnStops.filter((_, j) => j !== i);
        return { ...r, returnStops: arr };
      })
    }));
  });
  if (!route.returnStops?.length) {
    list.append(h('p', { class: 'muted' }, t('route.return.directHint')));
  }

  const addBtn = h('button', {
    class: 'btn-secondary',
    onclick: () => state.update('route', r => ({
      ...r,
      returnStops: [...(r.returnStops || []), { countryId: '', cityId: '', nights: 1, transport: 'train' }]
    }))
  }, t('route.return.addStop'));

  const homeCard = h('div', { class: 'return-home-card' }, [
    '→ 🏠 ',
    home ? t('route.return.homeCard', { city: home.name }) : t('route.home.modalTitle'),
    h('select', {
      'aria-label': 'transport',
      onchange: e => state.update('route', r => ({ ...r, returnTransport: e.target.value }))
    }, ['train', 'bus', 'flight'].map(m => h('option', { value: m }, m)))
  ]);

  const optimizeBtn = h('button', {
    class: 'btn-ai',
    onclick: () => window.dispatchEvent(new CustomEvent('ai:optimize-return'))
  }, t('route.return.optimizeBtn'));

  section.append(list, addBtn, homeCard, optimizeBtn);
  return section;
}
```

Hook `renderHomeChip()` and `renderReturnSection()` into the existing render function where outbound stops currently render. Subscribe to `state.user` and `state.route.returnStops` so the section re-renders on change (follow the file's existing subscribe pattern).

- [ ] **Step 4: Import**

At top:
```js
import { resolveHomeCoords, renderHomeCityPicker } from './home-city-picker.js';
```

- [ ] **Step 5: CSS**

Append to the route-builder stylesheet:
```css
.home-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem;
  border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border);
  font-size: 0.9rem; cursor: pointer; }
.home-chip-edit { font-size: 0.75rem; color: var(--accent); text-decoration: underline; }
.route-return-section { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed var(--border); }
.route-return-section h3 { margin: 0 0 0.5rem 0; font-size: 1rem; }
.toggle-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
.return-stops-list { display: flex; flex-direction: column; gap: 0.5rem; }
.return-home-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;
  background: var(--surface-2); border-radius: 0.5rem; margin-top: 0.5rem; }
.btn-ai { margin-top: 0.75rem; background: var(--accent); color: white; border: none;
  padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: grid;
  place-items: center; z-index: 1000; }
.modal-box { background: var(--surface); padding: 1.5rem; border-radius: 0.5rem; min-width: 320px; }
```

- [ ] **Step 6: Smoke**

- Reload app, go to route builder.
- Verify home chip shows "🏠 Ev: İstanbul".
- Click chip → modal → change city → Save → chip updates.
- Toggle "dönüşü dahil et" off/on → confirm `state.route.includeReturnInBudget` flips.
- Add a return stop → appears in list.

- [ ] **Step 7: Commit**

```bash
git add js/ui/route-builder.js css/
git commit -m "feat(v1.2): route-builder — home chip + return section with toggle and stops"
```

---

## Task 6: route-layer module (no arrows yet)

**Files:**
- Create: `js/map/route-layer.js`
- Modify: `js/pages/map.js`

- [ ] **Step 1: Write the module**

```js
// js/map/route-layer.js
// Owns all route rendering on the Leaflet map: outbound + return polylines,
// stop markers, home marker. Subscribes to state.route + state.user.
import { state } from '../state.js';
import { resolveHomeCoords } from '../ui/home-city-picker.js';

let outboundLayer = null;
let returnLayer = null;
let markersLayer = null;
let decorators = [];

function clearLayers(map) {
  if (outboundLayer) { map.removeLayer(outboundLayer); outboundLayer = null; }
  if (returnLayer)   { map.removeLayer(returnLayer);   returnLayer = null; }
  if (markersLayer)  { map.removeLayer(markersLayer);  markersLayer = null; }
  decorators.forEach(d => map.removeLayer(d));
  decorators = [];
}

function cityCoords(countryId, cityId) {
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === countryId);
  if (!country) return null;
  const city = (country.cities || []).find(c => c.id === cityId) || country.cities?.[0];
  return city ? [city.lat, city.lng] : null;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// divIcon HTML is built from static strings and numeric indexes only.
// Never interpolate user input into this helper.
function markerIcon(klass, label) {
  const safeLabel = String(label).replace(/[<>&"']/g, '');
  return L.divIcon({
    className: klass,
    html: `<div class="${klass}-inner">${safeLabel}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14]
  });
}

export function renderRouteLayer(map) {
  if (!window.L) return;
  clearLayers(map);

  const route = state.getSlice('route');
  const home = resolveHomeCoords();
  if (!route?.stops?.length || !home) return;

  const homeLatLng = [home.lat, home.lng];
  const outboundLatLngs = [
    homeLatLng,
    ...route.stops.map(s => cityCoords(s.countryId, s.cityId)).filter(Boolean)
  ];

  const returnLatLngs = [
    outboundLatLngs[outboundLatLngs.length - 1],
    ...(route.returnStops || []).map(s => cityCoords(s.countryId, s.cityId)).filter(Boolean),
    homeLatLng
  ];

  const accent  = cssVar('--accent')   || '#3b82f6';
  const accent2 = cssVar('--accent-2') || '#ef4444';

  outboundLayer = L.polyline(outboundLatLngs, {
    color: accent, weight: 3, dashArray: '8,6', opacity: 0.9
  }).addTo(map);

  returnLayer = L.polyline(returnLatLngs, {
    color: accent2, weight: 2.5, dashArray: '4,10', opacity: 0.85
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  L.marker(homeLatLng, {
    title: home.name,
    icon: L.divIcon({
      className: 'home-marker',
      html: '<div class="home-marker-inner">\u{1F3E0}</div>',
      iconSize: [32, 32], iconAnchor: [16, 16]
    })
  }).addTo(markersLayer);

  route.stops.forEach((stop, i) => {
    const c = cityCoords(stop.countryId, stop.cityId);
    if (!c) return;
    L.marker(c, { title: String(i + 1), icon: markerIcon('stop-marker-outbound', i + 1) }).addTo(markersLayer);
  });

  (route.returnStops || []).forEach((stop, i) => {
    const c = cityCoords(stop.countryId, stop.cityId);
    if (!c) return;
    const letter = String.fromCharCode(65 + (i % 26));
    L.marker(c, { title: letter, icon: markerIcon('stop-marker-return', letter) }).addTo(markersLayer);
  });
}

export function initRouteLayer(map) {
  renderRouteLayer(map);
  state.subscribe('route',  () => renderRouteLayer(map));
  state.subscribe('user',   () => renderRouteLayer(map));
  state.subscribe('theme',  () => renderRouteLayer(map));
}
```

- [ ] **Step 2: Wire from `map.js`**

In `js/pages/map.js`, near the top:
```js
import { initRouteLayer } from '../map/route-layer.js';
```
After the Leaflet map is created, call:
```js
initRouteLayer(map);
```
Remove any existing ad-hoc polyline drawing in `map.js` that is now redundant. Leave `wrapped.js` rendering alone.

- [ ] **Step 3: Add marker CSS to `css/map.css`**

```css
.home-marker-inner { background: var(--surface); border: 2px solid var(--accent);
  border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center;
  font-size: 1.1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.stop-marker-outbound-inner, .stop-marker-return-inner {
  color: white; border-radius: 50%;
  width: 28px; height: 28px; display: grid; place-items: center; font-weight: 600;
  font-size: 0.85rem; border: 2px solid var(--surface);
}
.stop-marker-outbound-inner { background: var(--accent); }
.stop-marker-return-inner   { background: var(--accent-2); }
```

- [ ] **Step 4: Smoke**

- Load app, add 2 outbound stops → see outbound dashed polyline from home to stops, numbered markers.
- Verify return dashed polyline goes from last stop back to home in accent-2 color.
- Toggle theme → colors update after next state.route change (or force by adding/removing a stop).

- [ ] **Step 5: Commit**

```bash
git add js/map/route-layer.js js/pages/map.js css/map.css
git commit -m "feat(v1.2): route-layer module — outbound + return polylines with home and numbered markers"
```

---

## Task 7: Directional arrows via PolylineDecorator

**Files:**
- Modify: `index.html`
- Modify: `js/map/route-layer.js`
- Modify: `js/sw.js`

- [ ] **Step 1: Add CDN in `index.html`**

After the Leaflet script tag:
```html
<script src="https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.min.js" defer></script>
```

- [ ] **Step 2: Bump SW cache**

In `js/sw.js`, change cache name constant from `v4` to `v5` (search for `discovereu-v4` or similar). SW is same-origin only per prior decision, so do not add CDN to precache list.

- [ ] **Step 3: Decorate polylines in route-layer**

In `js/map/route-layer.js`, after each polyline is created, add arrow decorators. Replace the polyline block inside `renderRouteLayer` with:

```js
outboundLayer = L.polyline(outboundLatLngs, {
  color: accent, weight: 3, dashArray: '8,6', opacity: 0.9
}).addTo(map);

if (L.polylineDecorator) {
  const d1 = L.polylineDecorator(outboundLayer, {
    patterns: [{
      offset: 25, repeat: 80,
      symbol: L.Symbol.arrowHead({
        pixelSize: 12, polygon: false, pathOptions: { stroke: true, color: accent, weight: 2 }
      })
    }]
  }).addTo(map);
  decorators.push(d1);
}

returnLayer = L.polyline(returnLatLngs, {
  color: accent2, weight: 2.5, dashArray: '4,10', opacity: 0.85
}).addTo(map);

if (L.polylineDecorator) {
  const d2 = L.polylineDecorator(returnLayer, {
    patterns: [{
      offset: 25, repeat: 80,
      symbol: L.Symbol.arrowHead({
        pixelSize: 12, polygon: false, pathOptions: { stroke: true, color: accent2, weight: 2 }
      })
    }]
  }).addTo(map);
  decorators.push(d2);
}
```

- [ ] **Step 4: Smoke with Playwright MCP**

- Reload app (hard reload to bypass SW).
- Add route: TR-IST → IT-ROM → FR-PAR.
- Verify outbound polyline has forward-pointing arrowheads every ~80px.
- Verify return polyline goes back to IST with arrowheads pointing toward home.
- Zoom in/out → arrows re-render without glitches.
- Screenshot `smoke-v12-arrows.png`.

- [ ] **Step 5: Commit**

```bash
git add index.html js/map/route-layer.js js/sw.js
git commit -m "feat(v1.2): directional arrows on route polylines via PolylineDecorator + SW cache v5"
```

---

## Task 8: Budget / credits / CO₂ — effectiveLegs

**Files:**
- Create: `js/features/effective-legs.js`
- Modify: `js/features/seat-credits.js`
- Modify: `js/features/co2.js`
- Modify: `js/features/reservations.js`
- Modify: `js/ui/budget.js`

- [ ] **Step 1: Create the helper**

```js
// js/features/effective-legs.js
// Combines outbound stops + optional return stops + home terminus into
// a single array of stops used for budget, CO2, and seat-credit math.
import { state } from '../state.js';
import { resolveHomeCoords } from '../ui/home-city-picker.js';

/**
 * Return an array of stops that reflects the traveler's full journey
 * when `includeReturnInBudget` is true, otherwise just the outbound stops.
 *
 * The terminal home "stop" is modeled as a zero-night stop so reservation
 * lookups can check the final leg (last real stop → home country).
 */
export function getEffectiveLegs(route = state.getSlice('route')) {
  const outbound = route?.stops || [];
  if (!route?.includeReturnInBudget) return outbound;

  const home = resolveHomeCoords();
  if (!home) return outbound;

  const homeStop = {
    countryId: home.countryId,
    cityId: home.cityId,
    nights: 0,
    transport: route.returnTransport || 'train',
    isHome: true
  };
  return [...outbound, ...(route.returnStops || []), homeStop];
}
```

- [ ] **Step 2: Update `reservations.js`**

Replace `const stops = route?.stops || [];` in `getRouteReservations` with:
```js
import { getEffectiveLegs } from './effective-legs.js';
// ...
const stops = getEffectiveLegs(route);
```

- [ ] **Step 3: Update `co2.js`**

At the top of `computeCO2`, replace the iteration over `route.stops` with `getEffectiveLegs(route)`. Add the import.

- [ ] **Step 4: Update `seat-credits.js`**

`computeSeatCredits` already consumes `getRouteReservations(route)`, so it automatically picks up the return legs once Step 2 is done. Verify via Step 6.

- [ ] **Step 5: Update `ui/budget.js`**

If `budget.js` iterates `route.stops` directly for per-night accommodation/food math, switch to `getEffectiveLegs(route)`:
```bash
grep -n "route.stops\|stops\\." js/ui/budget.js
```
Replace each iteration site.

- [ ] **Step 6: Smoke**

In DevTools:
```js
const { getEffectiveLegs } = await import('./js/features/effective-legs.js');
const { computeSeatCredits } = await import('./js/features/seat-credits.js');
const { computeCO2 } = await import('./js/features/co2.js');

state.update('route', r => ({
  ...r,
  stops: [{countryId:'de',cityId:'ber',nights:3,transport:'train'}, {countryId:'cz',cityId:'prg',nights:2,transport:'train'}],
  returnStops: [{countryId:'hu',cityId:'bud',nights:1,transport:'train'}],
  includeReturnInBudget: true
}));
console.log('legs on:', getEffectiveLegs().length);
console.log('credits:', computeSeatCredits());
console.log('co2:',     computeCO2(state.getSlice('route')));

state.update('route', r => ({ ...r, includeReturnInBudget: false }));
console.log('legs off:', getEffectiveLegs().length);
```
Expect: `legs on` > `legs off`.

- [ ] **Step 7: Commit**

```bash
git add js/features/effective-legs.js js/features/seat-credits.js js/features/co2.js js/features/reservations.js js/ui/budget.js
git commit -m "feat(v1.2): effectiveLegs — budget, credits, CO2 include return when toggle is on"
```

---

## Task 9: AI schema + prompt + optimize-return action

**Files:**
- Modify: `js/features/llm-adapter.js`
- Modify: `js/features/llm-groq.js`, `llm-gemini.js`, `llm-openai.js` (wherever prompt/schema live)
- Modify: `js/features/ai-assistant.js`
- Modify: `js/ui/ai-modal.js`

- [ ] **Step 1: Find the current route schema**

```bash
grep -n "routeSchema\|schema\|stops" js/features/llm-adapter.js js/features/llm-groq.js js/features/llm-gemini.js js/features/llm-openai.js
```

- [ ] **Step 2: Extend the schema**

Wherever `routeSchema` is defined, add `returnLeg`:
```js
returnLeg: {
  type: 'object',
  properties: {
    stops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          countryId: { type: 'string' },
          cityId:    { type: 'string' },
          nights:    { type: 'number' },
          transport: { type: 'string', enum: ['train','bus','flight','night-train'] },
          note:      { type: 'string' }
        },
        required: ['countryId','cityId','transport']
      }
    },
    transport: { type: 'string', enum: ['train','bus','flight'] },
    reasoning: { type: 'string' }
  }
}
```

- [ ] **Step 3: Extend the system prompt**

In the system-prompt string used by all adapters, add:
```
The user's home is {homeCountry}/{homeCity}. Plan BOTH outbound and return.
The return leg may include 0–2 intermediate stops when it improves the trip
(night-train stopover, scenic detour, using unused seat credits).
Respect includeReturnInBudget={includeReturnInBudget}: if true, your plan
must not exceed seatCreditsLimit={seatCreditsLimit} or travelDaysLimit={travelDaysLimit}
across outbound AND return combined. Return a routeSchema object with
`stops` (outbound) and `returnLeg` (return).
```
Replace the placeholders at call time with actual values from `state.user` + `state.route`.

- [ ] **Step 4: Parse returnLeg in `ai-assistant.js`**

When an AI response arrives, after writing `stops` to `state.route.stops`, also write:
```js
if (parsed.returnLeg?.stops) {
  state.update('route', r => ({
    ...r,
    returnStops: parsed.returnLeg.stops,
    returnTransport: parsed.returnLeg.transport || r.returnTransport
  }));
}
```

- [ ] **Step 5: Add "optimize return" handler**

In `ai-assistant.js`:
```js
window.addEventListener('ai:optimize-return', async () => {
  const route = state.getSlice('route');
  const user  = state.getSlice('user');
  const toast = await import('../ui/toast.js');
  toast.show(t('ai.return.optimizing'));

  const system = `You plan ONLY the return leg. The outbound (frozen) is:
${JSON.stringify(route.stops)}
Home: ${user.homeCountry}/${user.homeCity}.
Return a JSON object { returnLeg: { stops, transport, reasoning } }.
0–2 intermediate stops. Respect includeReturnInBudget=${route.includeReturnInBudget}.`;

  const { callLLM } = await import('./llm-adapter.js');
  const result = await callLLM({ system, user: 'Optimize my return.' });
  if (!result?.returnLeg) { toast.show('AI failed'); return; }

  showReturnDiff(route.returnStops, result.returnLeg);
});

function showReturnDiff(current, proposed) {
  const backdrop = h('div', { class: 'modal-backdrop' });
  const box = h('div', { class: 'modal-box' });
  box.append(
    h('h3', {}, t('route.return.sectionTitle')),
    h('div', {}, [h('h4', {}, 'Current'),  h('pre', {}, JSON.stringify(current, null, 2))]),
    h('div', {}, [h('h4', {}, 'Proposed'), h('pre', {}, JSON.stringify(proposed.stops, null, 2))]),
    h('p', {}, proposed.reasoning || ''),
    h('button', { onclick: () => {
      state.update('route', r => ({
        ...r,
        returnStops: proposed.stops,
        returnTransport: proposed.transport || r.returnTransport
      }));
      backdrop.remove();
    }}, t('ai.return.accept')),
    h('button', { onclick: () => backdrop.remove() }, t('ai.return.reject'))
  );
  backdrop.append(box);
  document.body.appendChild(backdrop);
}
```

- [ ] **Step 6: Smoke**

- Set a Groq key in settings.
- Ask AI for a full route ("3-week trip to Central Europe") — verify `returnStops` is populated.
- Click "Dönüşü AI ile optimize et" — verify diff modal appears, accept updates only `returnStops`, reject leaves it untouched.

- [ ] **Step 7: Commit**

```bash
git add js/features/llm-*.js js/features/ai-assistant.js js/ui/ai-modal.js
git commit -m "feat(v1.2): AI — returnLeg schema, prompt update, optimize-return action with diff modal"
```

---

## Task 10: Route templates with returnLeg

**Files:**
- Modify: `data/route-templates.json`

- [ ] **Step 1: Add `returnLeg` to 3 templates**

Identify template ids:
```bash
head -60 data/route-templates.json
```
For 3 flagship templates, add:

Template 1 (e.g. "Central Europe Rail"):
```json
"returnLeg": {
  "stops": [{ "countryId": "cz", "cityId": "prg", "nights": 1, "transport": "night-train" }],
  "transport": "night-train"
}
```

Template 2 (e.g. "Mediterranean Coast"):
```json
"returnLeg": {
  "stops": [{ "countryId": "gr", "cityId": "ath", "nights": 1, "transport": "flight" }],
  "transport": "flight"
}
```

Template 3 (e.g. "Iberian Loop"):
```json
"returnLeg": { "stops": [], "transport": "train" }
```

- [ ] **Step 2: Update template loader**

```bash
grep -rn "route-templates\|applyTemplate" js/
```
In the apply function:
```js
state.update('route', r => ({
  ...r,
  stops: template.stops,
  returnStops: template.returnLeg?.stops || [],
  returnTransport: template.returnLeg?.transport || 'train',
  name: template.name
}));
```

- [ ] **Step 3: Smoke**

Apply each of the 3 flagship templates; verify return section populates and map draws return polyline.

- [ ] **Step 4: Commit**

```bash
git add data/route-templates.json js/
git commit -m "feat(v1.2): route templates — returnLeg field + loader writes returnStops"
```

---

## Task 11: Route summary overlay

**Files:**
- Modify: `js/pages/map.js` (the `renderRouteSummary` function)

- [ ] **Step 1: Update the overlay**

Find `renderRouteSummary` in `js/pages/map.js`. After the existing stats, add a return badge:
```js
const route = state.getSlice('route');
const returnBadge = h('div', { class: 'route-summary-stat return-badge' }, [
  '🏠 ',
  route.includeReturnInBudget ? t('route.return.sectionTitle') + ' ✓' : t('route.return.sectionTitle') + ' –'
]);
card.append(returnBadge);
```
Subscribe to `state.route.includeReturnInBudget` changes (the existing `route` subscription covers it).

- [ ] **Step 2: Smoke**

Toggle in route builder → badge updates in map overlay.

- [ ] **Step 3: Commit**

```bash
git add js/pages/map.js
git commit -m "feat(v1.2): route summary overlay — return badge"
```

---

## Task 12: Final smoke + PROGRESS.md + push

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full Playwright smoke (20 scenarios)**

1. Cold start wizard with cleared storage → home step present.
2. Select TR + IST → finish wizard → localStorage has `homeCity: 'ist'`.
3. Go to map → route empty → home marker visible at IST.
4. Add Berlin, Prague outbound → numbered markers + dashed outbound polyline with arrowheads.
5. Toggle return off → budget/credits drop; return polyline still drawn.
6. Toggle return on → budget/credits rise; math consistent with `getEffectiveLegs`.
7. Add Budapest as return stop → return polyline routes via BUD → IST.
8. Change home to ANK via route-builder chip modal → polylines re-anchor to ANK.
9. Apply "Central Europe" template → return stop PRG populated.
10. Zoom in/out → arrows re-render cleanly.
11. Dark theme toggle → colors update on next route edit.
12. AI: give key, ask "plan a 3-week Central Europe trip" → `returnStops` populated from AI.
13. AI: click "Dönüşü optimize et" → diff modal → accept → `returnStops` updated, `stops` unchanged.
14. Reject path of #13 → nothing changes.
15. Switch language to TR, DE, FR, ES, IT → no raw i18n keys in return UI.
16. Mobile 375px width → return section scrolls cleanly, modal fits viewport.
17. PWA install → offline load → route renders (graceful degrade if decorator blocked).
18. SW cache bumped to v5 → verify via DevTools → Application → Cache Storage.
19. Keyboard: Tab through home chip → modal → return toggle → add-return-stop → home card → all focusable.
20. Reload → round-trip preserved.

- [ ] **Step 2: Update PROGRESS.md**

Under `### ✅ Done`:
```md
- **v1.2: Round-trip routing + directional arrows + AI returnLeg** (2026-04-13)
  - `state.user.homeCity` + welcome wizard home step + route-builder home chip
  - `state.route.returnStops` + `includeReturnInBudget` toggle
  - `js/map/route-layer.js` owns all route drawing — outbound + return polylines
  - `leaflet-polylinedecorator@1.6.0` CDN — dashed lines + repeating arrowheads
  - Outbound: accent, `8,6` dash; Return: accent-2, `4,10` dash; arrows every 80px
  - Numbered markers (1,2,3) outbound; lettered (A,B) return; 🏠 home marker
  - `js/features/effective-legs.js` — budget/credits/CO2 include return when toggle on
  - LLM schema extended with `returnLeg`; prompt plans both legs with 0–2 return stops
  - AI modal "Dönüşü optimize et" — regenerates return only, diff modal accept/reject
  - 3 route templates gained `returnLeg` field; loader writes `returnStops`
  - 6 i18n locales (en/tr/de/fr/es/it) extended
  - PWA cache v4 → v5
  - All 20 smoke tests pass
```

- [ ] **Step 3: Commit + push**

```bash
git add PROGRESS.md
git commit -m "docs(v1.2): round-trip routing sub-project complete — 20/20 smoke pass"
git push
```

---

## Self-review

- **Spec coverage:** §4 data model → Task 1; §5 UI → Tasks 3/4/5/11; §6 map → Tasks 6/7; §7 AI → Task 9; §8 budget math → Task 8; §9 files touched → all tasks; §11 testing → Task 12. ✓
- **Placeholders:** none — all code blocks concrete. ✓
- **Type consistency:** `returnStops`, `includeReturnInBudget`, `resolveHomeCoords`, `getEffectiveLegs`, `renderRouteLayer`, `initRouteLayer`, `markerIcon`, `cssVar`, `clearLayers` consistent across tasks. ✓
- **XSS safety:** no innerHTML with interpolated data; divIcon html strings are static or numeric-only; `markerIcon` strips HTML metacharacters as belt-and-braces. ✓
- **Scope:** single sub-project, 12 discrete tasks, each with its own commit. ✓
