# Round-Trip Routing + Directional Arrows + AI Update — Design

**Date:** 2026-04-13
**Status:** Approved (user-reviewed in brainstorming)
**Scope:** v1.2 sub-project — map page routing upgrade
**Launch constraint:** 2026-04-22

---

## 1. Problem

Current route builder and map only model a one-way journey. Reality: every DiscoverEU traveler must return home. The map also shows the route as a plain polyline with no direction cue — unclear which stop is first, which is last, and where "home" is.

## 2. Goals

1. Every route has a home city on both ends (outbound origin + return terminus).
2. Return leg is a first-class travel segment — can include intermediate stops, can be included in or excluded from budget/seat-credit math.
3. Map polylines visually communicate direction (dashed line + repeating arrowheads).
4. Outbound and return are visually distinct (color + dash pattern).
5. AI proposes both outbound and return; user can regenerate return independently.
6. User can manually edit return with the same richness as outbound.

## 3. Non-goals

- Intermodal routing across air+rail+bus in a single leg with live-pricing (out of scope for v1.2).
- Multi-origin trips (e.g. group members starting from different cities) — single home city only.
- Live train-booking integration.

## 4. Data model

### 4.1 `state.user`

```js
user: {
  homeCountry: 'TR',
  homeCity: 'IST',   // NEW — city id from countries.json[countryId].cities[]
  ...
}
```

Migration: on load, if `homeCity` missing, fall back to the capital of `homeCountry` (first city in `cities[]`).

### 4.2 `state.route`

```js
route: {
  stops: [...],                  // outbound stops (unchanged)
  returnStops: [],               // NEW — optional intermediate return stops
  includeReturnInBudget: true,   // NEW — toggle affecting seat credits, days, cost, CO2
  travelDaysLimit: 7,
  seatCreditsLimit: 4,
  name: ''
}
```

`returnStops` has the same shape as `stops`: `{ countryId, cityId, nights, transport }`. Empty array = direct last-stop → home.

### 4.3 `data/route-templates.json`

Each template may add:

```json
{
  "returnLeg": {
    "stops": [ { "countryId": "cz", "cityId": "prg", "nights": 1, "transport": "night-train" } ],
    "transport": "train"
  }
}
```

Backward compatible: missing `returnLeg` → UI renders a direct return.

### 4.4 `data/countries.json`

Ensure TR has a `cities[]` array with at least IST, ANK, IZM, ESB (and lat/lng for each). Add for any other country missing city entries that a home-city picker needs.

## 5. UI

### 5.1 Welcome wizard

New step between language and group-size: **"Home city"**.
- Country dropdown (defaults to detected locale or TR).
- City dropdown (filtered by country).
- Writes `state.user.homeCountry` + `state.user.homeCity`.
- Step is skippable; defaults to TR/IST.

### 5.2 Route builder (`js/ui/route-builder.js`)

- **Top chip:** `🏠 Ev: İstanbul 🇹🇷 [değiştir]` — opens a modal reusing the wizard's country+city picker.
- **New section below outbound stops: "Dönüş"**
  - Toggle (`role="switch"`): `Dönüşü bütçeye ve seat credit'lere dahil et` (default on).
  - Reorderable/editable stop list, same editor component as outbound, bound to `state.route.returnStops`.
  - Fixed terminal card: `→ Ev: İstanbul` (non-deletable) with transport selector (train | bus | flight).
  - Button: **"AI ile dönüşü öner"** — triggers AI return-only regeneration (see §7).

### 5.3 Route summary overlay

`N stop · M gece · K seat credit · [🏠 dönüş dahil|hariç]` — reflects toggle state.

### 5.4 A11y + i18n

- Toggle `role="switch"` + `aria-checked`.
- New strings in `i18n/{en,tr,de,fr,es,it}.json`.
- Keyboard: return-section stop list follows the same focus order as outbound.

## 6. Map & arrows

### 6.1 Dependency

Add CDN in `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.min.js" defer></script>
```

Bump `js/sw.js` cache → v5; precache the new CDN asset.

### 6.2 New module: `js/map/route-layer.js`

Single responsibility: render the route (outbound + return) on the Leaflet map.
- Subscribes to `state.route`, `state.user.homeCity`, `state.user.homeCountry`, `state.theme`.
- Resolves coordinates from `countries.json`. Missing home city → country capital fallback.
- Builds two polylines:

| Leg | Color | Dash | Weight | Arrow pattern |
|---|---|---|---|---|
| Outbound | `var(--accent)` | `8,6` | 3 | every 80px, pixelSize 12, forward |
| Return | `var(--accent-2)` | `4,10` | 2.5 | every 80px, pixelSize 12, forward (polyline is drawn in return direction, so "forward" points toward home) |

- Stop markers: numbered circles (1, 2, 3 …) for outbound; letters (A, B, …) for return intermediate stops.
- Home marker: 🏠 icon with accent-bordered circle.
- On theme change, re-read CSS vars and refresh styles.
- Replaces ad-hoc polyline drawing currently scattered across map code.

### 6.3 Removal

Current route-drawing code in `js/pages/map.js` (and any inline drawing elsewhere except `wrapped.js`) moves to `route-layer.js`. `wrapped.js` keeps its own static-canvas rendering.

## 7. AI

### 7.1 Schema (`js/features/llm-adapter.js`)

Extend `routeSchema`:

```json
{
  "stops": [ ... ],
  "returnLeg": {
    "stops": [ { "countryId": "...", "cityId": "...", "nights": 0, "transport": "train|bus|flight|night-train", "note": "..." } ],
    "transport": "train|bus|flight",
    "reasoning": "why this return shape"
  }
}
```

All three adapters (`llm-groq.js`, `llm-gemini.js`, `llm-openai.js`) use the unified schema.

### 7.2 System prompt additions

- Provide `homeCity`, `homeCountry`, `includeReturnInBudget`, `seatCreditsLimit`, `travelDaysLimit` remaining.
- Instruct: plan both legs; return leg may include 0–2 intermediate stops when it improves the trip (night-train stopover, scenic detour, unused seat credits).
- Enforce: respect toggle for budget math; don't exceed seat credits / travel-day limits when toggle on.

### 7.3 New action: "Dönüşü optimize et"

In AI modal, button that calls the LLM with outbound frozen + ask only for `returnLeg`. Diff-view (current vs proposed return) with Accept / Reject. Only `state.route.returnStops` is mutated.

## 8. Budget / credits / CO₂

`seat-credits.js`, `co2.js`, `ui/budget.js`, `features/reservations.js`:
- Compute an `effectiveLegs` array: `stops` concat (if `includeReturnInBudget`) `returnStops` concat terminal home leg.
- All existing math runs over `effectiveLegs` unchanged.
- When toggle is off, calculations use `stops` only (today's behavior).

## 9. Files touched

**New:**
- `js/map/route-layer.js`
- `docs/superpowers/specs/2026-04-13-roundtrip-routing-design.md` (this file)

**Modified:**
- `js/state.js`
- `js/ui/welcome-wizard.js`
- `js/ui/route-builder.js`
- `js/pages/map.js`
- `js/features/ai-assistant.js`
- `js/features/llm-adapter.js` (+ groq/gemini/openai adapters if prompt lives there)
- `js/features/seat-credits.js`
- `js/features/co2.js`
- `js/ui/budget.js`
- `js/features/reservations.js`
- `data/route-templates.json` (+2–3 sample templates get a `returnLeg`)
- `data/countries.json` (TR cities if missing; any gaps surfaced by picker)
- `i18n/en.json`, `tr.json`, `de.json`, `fr.json`, `es.json`, `it.json`
- `index.html` (PolylineDecorator CDN)
- `js/sw.js` (cache v5)
- `PROGRESS.md`

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Existing users without `homeCity` | Fallback to country capital on first load; wizard prompts once on next visit |
| PolylineDecorator theme mismatch | Re-read CSS vars on `state.theme` change; re-apply decorator styles |
| Route-templates lacking `returnLeg` | Optional field, UI renders direct-return default |
| AI returns invalid JSON | Adapter already validates + retries; extend validator for `returnLeg` shape |
| Seat credit / travel-day overruns on return | Toggle-aware validator shows warning in route summary |
| CDN script load fails offline | SW precaches PolylineDecorator; graceful degrade to plain dashed polyline if global missing |

## 11. Testing

- Smoke: load app cold with no `homeCity` → wizard prompts → route renders with home marker.
- Toggle off → budget math excludes return; toggle on → includes it.
- AI "optimize return" → diff shown → accept updates only `returnStops`.
- Map zoom in/out → arrows re-render cleanly.
- Dark/light theme swap mid-route → colors update.
- Templates with and without `returnLeg` both render.
- 375px width: route builder return section collapsible to keep viewport usable.

## 12. Out of scope

- Changing how `wrapped.js` draws its static route.
- Adding multi-origin (group members from different cities).
- Real-time train booking.
