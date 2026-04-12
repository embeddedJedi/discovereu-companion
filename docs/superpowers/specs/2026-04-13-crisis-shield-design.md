# Crisis Shield — v1.3 Design Spec

**Date:** 2026-04-13
**Status:** Draft (design only — implementation plan is a separate task)
**Strategic role:** Flagship inclusion narrative for KA3 grant application. Offline-first safety layer that lowers the threshold for participation for fewer-opportunities youth (first-time travellers, disabled travellers, women, LGBTQ+ youth, non-English speakers).

---

## 1. Purpose

A fully offline, zero-PII emergency & safety layer integrated into every country card of the user's route. It turns the existing v1.1 consulate reminder into a comprehensive "what do I do right now" shield that works on a dead SIM with one bar of signal.

## 2. Scope

In: emergency numbers, extended TR consulate coverage, foreign-embassy lookup pattern, flowcharts (lost passport / lost card / medical), EU 112 explainer + dial quirks, one-tap share-location card, route integration.
Out (deferred): live disaster feeds, real-time hospital availability, insurance claim filing, in-app translation of spoken audio, backend-stored incident reports.

## 3. Data model

### 3.1 New: `data/emergency-numbers.json`
Per-country record (33 countries):
```
{
  "countryId": "FR",
  "eu112": true,
  "numbers": {
    "general": "112",
    "police":  "17",
    "ambulance": "15",
    "fire":    "18",
    "touristPolice": null,
    "women":   "3919",
    "lgbtq":   "0 810 20 30 40",
    "childProtection": "119",
    "mentalHealth": "3114"
  },
  "dialQuirks": ["UK uses 999; 112 also works", "..."],
  "sources": ["ec.europa.eu/…", "gov.fr/…"],
  "lastVerified": "2026-04-10"
}
```

### 3.2 Extended: `data/tr-consulates.json` → `data/tr-missions.json`
Rename + extend to cover all 33 DiscoverEU countries. Add a `mission` block alongside `centres`:
```
"mission": {
  "type": "embassy|consulate-general|honorary",
  "city": "Paris",
  "address": "…",
  "phone24h": "+33 …",
  "emergencyEmail": "…",
  "mapsUrl": "https://maps.app.goo.gl/…"
}
```
Back-compat: existing `centres[]` (visa centres in Türkiye) remains; new `mission` describes TR representation **inside** the destination country. Loader updated to serve both.

### 3.3 New: `data/embassy-lookup-pattern.json`
For non-Turkish users: per-destination country, a URL template to find *their own* embassy (e.g. `https://www.google.com/search?q={home}+embassy+in+{dest}`, plus structured hints like `mfa.{home}` patterns). No data collected — the app just builds a link.

### 3.4 New: `data/crisis-flowcharts.json`
Three flowcharts (`lost-passport`, `lost-card`, `medical`), each a DAG of nodes:
```
{ "id": "lp-1", "type": "step", "textKey": "flow.lp.call112", "next": "lp-2" }
{ "id": "lp-2", "type": "decision", "textKey": "...", "options": [...] }
```
Localised via i18n keys, never embedded copy.

### 3.5 Reused: `data/emergency-phrases.json`
No schema change; already contains 6-language phrase packs. Flowchart leaves link into matching phrase groups.

## 4. New JS modules

- `js/features/crisis-shield.js` — entrypoint: `renderCrisisShieldCard(countryId)`, `openFullShield(countryId)`, `shareLocation()`.
- `js/features/flowchart-runner.js` — generic DAG traverser, keyboard-navigable, back stack, "reset" action.
- `js/features/share-location.js` — builds `geo:` URI + OSM fallback link, calls `navigator.share()`, falls back to clipboard. No geolocation persisted.
- `js/ui/crisis-shield-panel.js` — modal/overlay renderer (full-screen on mobile, side-panel on desktop).
- `js/ui/emergency-dial-list.js` — accessible tel: link list with large tap targets.

State touched: none persistent. Ephemeral UI state only (current flowchart node) kept in module scope.

## 5. CSS additions (`css/crisis-shield.css`)

- `.cs-card` (red-coded but AAA-contrast), `.cs-dial-grid`, `.cs-flowchart`, `.cs-node`, `.cs-share-btn`, `.cs-mission-block`, `.cs-quirk-list`.
- Large-type mode variant `.cs-card--largetype` (22px base) — inclusion requirement.
- High-contrast emergency palette via new tokens `--cs-critical`, `--cs-critical-fg` in `design-system.css`, verified ≥ 7:1 (AAA).

## 6. i18n keys (EN source only; translation is a separate task)

Namespace `crisis.*`:
`crisis.title`, `crisis.call112`, `crisis.dialQuirk`, `crisis.police`, `crisis.ambulance`, `crisis.fire`, `crisis.tourist`, `crisis.women`, `crisis.lgbtq`, `crisis.child`, `crisis.mental`, `crisis.trMission`, `crisis.trMission24h`, `crisis.ownEmbassy`, `crisis.ownEmbassyHint`, `crisis.shareLocation`, `crisis.shareLocationBody`, `crisis.shareCopy`, `crisis.offlineNote`, `crisis.noPII`.
Namespace `flow.lp.*`, `flow.card.*`, `flow.med.*` (≈ 30 keys each — step text, decision prompts, option labels, back, restart, done).

## 7. Service Worker precache additions

Append to precache manifest in `sw.js`:
`data/emergency-numbers.json`, `data/tr-missions.json`, `data/embassy-lookup-pattern.json`, `data/crisis-flowcharts.json`, `data/emergency-phrases.json` (already), `css/crisis-shield.css`, all new `js/features/crisis-*.js` + `js/ui/crisis-*.js`. Target: full Crisis Shield available on cold-load airplane mode.

## 8. Route integration

`js/ui/country-panel.js` gains a "Crisis Shield" section right after the weather block — compact card (3 biggest numbers + "Open full shield" button). Full shield opens panel from section 4.

## 9. Accessibility (WCAG AAA target)

- All `tel:` buttons ≥ 56×56 CSS px, visible focus ring, `aria-label` with full readable number.
- Flowchart nodes are `role="group"` with `aria-live="polite"` on active node.
- Keyboard: Tab traversal, `Enter` advances, `Backspace` / `Alt+←` goes back, `Esc` closes overlay.
- Reduced-motion respected for node transitions.
- Colour never the sole indicator; every critical number has an icon + text label.
- Screen reader announces dial quirks before dialling shortcuts.

## 10. Privacy

No PII collected. Geolocation requested only on explicit share-location tap, used once, never stored, not sent anywhere. All data files are static JSON, zero runtime network calls.

## 11. Risks

- Data staleness (helpline numbers change) → `lastVerified` field + quarterly refresh task.
- Wrong number in an emergency is worse than no number → require two independent sources per entry; mark unverified entries as `"verified": false` and hide by default.
- LGBTQ+ helpline availability varies and is politically sensitive in some states → include only where an officially recognised NGO line exists; never infer.
- `navigator.share` unsupported on some desktops → clipboard fallback + visible geo link.
- Flowcharts must never contradict official advice → each terminal node links to the authoritative source.

## 12. Out of scope (future)

Live incident feeds, multi-party check-in, auto-SOS, travel-insurance integration, in-app VoIP calling, offline map tiles around mission addresses (candidate for v1.4).
