# v1.7 — Green Hostel + Carbon Offset Layer

**Date:** 2026-04-13
**Grant mapping:** Erasmus+ KA220-YOU (Green priority) · EU Youth Strategy "Green & Sustainable Europe"
**Status:** Design spec — implementation pending

---

## 1. Goal

Lower the threshold for sustainable travel choices during a DiscoverEU trip by (a) surfacing certified green hostels along the user's route and (b) offering an educational, non-pushy carbon offset pathway on the Impact card. Reinforces the "green and inclusive" positioning required by EACEA review.

## 2. Scope

**In:** curated hostel overlay, map layer toggle, Impact card offset CTA, i18n, accessibility, privacy guards, grant narrative.
**Out (v1.7):** direct booking, affiliate tracking, per-leg carbon labels, partner discount codes, any API requiring keys.

## 3. Data model

### `data/green-hostels.json`
Array of entries; curated, 3–5 per major DiscoverEU city, ~30 cities at launch (~120 rows).

```json
{
  "id": "berlin-eastseven",
  "cityId": "berlin",
  "countryId": "DE",
  "name": "EastSeven Berlin Hostel",
  "cert": "EU_ECOLABEL",
  "certLevel": "standard",
  "url": "https://example.com",
  "lat": 52.5346,
  "lng": 13.4106,
  "priceTier": 2,
  "sustainabilityScore": 4,
  "verifiedAt": "2026-04-13",
  "sourceUrl": "https://environment.ec.europa.eu/ecolabel/..."
}
```

**Cert enum:** `EU_ECOLABEL` · `GREEN_KEY` · `LEED` · `NORDIC_SWAN` · `BIOSPHERE` · `NATIONAL_EQUIV`.
**Rule:** no entry without `sourceUrl` pointing to the issuing body's registry. Curator commits reject unsourced rows.

### Schema file
`data/schemas/green-hostel.schema.json` — JSON Schema used by `tools/validate-data.js` in CI.

## 4. Map layer

### `js/map/green-hostels-layer.js`
- Exports `createGreenHostelsLayer(map, state)` returning a Leaflet `LayerGroup`.
- Loads `data/green-hostels.json` lazily on first toggle.
- Filters by `state.route.cityIds` when route exists; else shows all.
- Marker: green-tinted SVG leaf icon, size 28px, `role="button"`, `aria-label` = `${name}, ${certLabel}`.
- Popup: name, cert badge (icon + text), sustainability score (1–5 leaf bar), price tier, external link with `rel="noopener noreferrer"` and external-link icon.

### Filter integration
`js/map/filters.js` — add `greenHostelsOnly` boolean and a new toggle row labelled via `i18n('filters.greenHostels')`. State slice:
```js
state.filters.greenHostelsOnly = false;
```
Layer subscribes to state; toggle hides/shows the group. When `true`, dims non-green hostel pins (existing OpenTripMap layer) to 30% opacity rather than removing, to preserve context.

## 5. Impact card extension

### `js/ui/offset-cta.js`
Reusable module exporting `renderOffsetCta(container, tripCo2Kg)`.
Mounted inside:
- Impact Dashboard panel (below existing CO₂ chart)
- Wrapped Story export card (dedicated final slide)

Contents:
- Heading: `i18n('offset.title')` — "Balance your trip"
- Body: short explainer (≤60 words) distinguishing **tree planting** (slow, reversible) vs **verified emission reductions** (Gold Standard / VCS). Educational tone, no sales copy.
- Three outbound link buttons: myclimate.org, ClimateCare, Gold Standard Marketplace. Each opens in new tab, flagged with external-link icon and screen-reader suffix "(opens in new tab)".
- Footnote: "Offsetting does not replace reducing emissions." — always visible.

No click tracking. No `utm_*` params. No affiliate IDs.

## 6. i18n

New key families in all 6 locales:
- `green.filter.toggle`, `green.cert.ecolabel`, `green.cert.greenKey`, `green.cert.leed`, `green.cert.nordicSwan`, `green.cert.biosphere`, `green.cert.nationalEquiv`, `green.score.label`, `green.priceTier.1..4`
- `offset.title`, `offset.intro`, `offset.trees.label`, `offset.verified.label`, `offset.disclaimer`, `offset.providers.myclimate`, `offset.providers.climatecare`, `offset.providers.goldstandard`, `offset.externalLink.sr`

English source committed; TR/DE/FR/ES/IT translations queued for translation sub-project.

## 7. Accessibility

- Cert badges: decorative icon `aria-hidden`, full cert name in visible text, plus `<abbr title="European Union Ecolabel">EU Ecolabel</abbr>`.
- Sustainability score leaves: `role="img"` with `aria-label="4 of 5 sustainability leaves"`.
- Marker focus ring: 2px `--color-focus`.
- External-link icon: `aria-hidden`, SR text appended via visually-hidden span.
- Contrast: green marker against map tiles validated ≥ 4.5:1 with outline stroke.

## 8. Privacy

- No third-party scripts loaded.
- No referrer leakage: links use `referrerpolicy="no-referrer"`.
- No localStorage event for offset click — only a non-persistent session counter for the "how many users explored offsets" in-memory debug metric (not exported).

## 9. Grant narrative (KA220 Green)

Maps to Erasmus+ KA220-YOU priority **"Environment and fight against climate change"** and EU Youth Goal 10 "Sustainable Green Europe". Demonstrates: (1) behaviour-change nudge grounded in verified certifications, (2) transparency (source-linked data), (3) youth agency (educational framing, opt-in). Cite in grant annex as a concrete inclusion+green feature, not a commercial layer.

## 10. Startup-phase upgrade path (documented, not built)

Post-grant, a `partners` field can be added to hostel entries holding `{ referralCode, discountPct, tosUrl }`. A separate module `js/features/partner-offers.js` would render the code behind an explicit user-consent gate (GDPR). **Not in v1.7.** Keeps current build free of any commercial surface.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Greenwashing of listed hostels | Only accept certs with public registries; `verifiedAt` ≤ 12 months; quarterly re-verification task |
| Incomplete city coverage embarrasses | Label layer as "Curated selection" in popup header; link to full EU Ecolabel registry |
| Offset efficacy debates | Explainer text names both mechanisms honestly; include "does not replace reducing" disclaimer |
| External link rot | CI check pings `url` + `sourceUrl` monthly, flags 404s |
| Perceived commercial bias | No affiliate IDs; three providers shown, alphabetical order |

## 12. Files touched

- `data/green-hostels.json` (new)
- `data/schemas/green-hostel.schema.json` (new)
- `js/map/green-hostels-layer.js` (new)
- `js/map/filters.js` (extend)
- `js/ui/offset-cta.js` (new)
- `js/ui/impact-dashboard.js` (mount CTA)
- `js/features/wrapped-story.js` (offset slide)
- `js/state.js` (add `filters.greenHostelsOnly`)
- `i18n/*.json` (6 files, new key families)
- `css/components/green-hostel.css` (new)

## 13. Acceptance criteria

1. Toggle filter renders ≥3 certified hostels per tested city (Berlin, Paris, Lisbon, Prague, Istanbul).
2. Every entry has resolvable `sourceUrl`.
3. Impact card shows offset CTA for any trip with `co2Kg > 0`.
4. Lighthouse a11y ≥ 95 with layer active.
5. No network requests to non-whitelisted domains.
6. All strings resolve through i18n; no hardcoded English.
