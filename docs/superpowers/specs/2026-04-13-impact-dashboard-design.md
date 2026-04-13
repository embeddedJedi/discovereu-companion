# v1.4 Impact Dashboard — Design Spec

**Date:** 2026-04-13
**Status:** Design draft (no implementation plan)
**Owner:** architect
**Grant hook:** KA154 / KA220 "Impact & Dissemination" sections — turns a speculative proposal into a de-risked, evidence-backed scale-up ask.

---

## 1. Goal

Give every user a personal, Strava-style impact card at trip end, and publish an anonymised, CC-BY-4.0 aggregate dataset the consortium can cite in Erasmus+ impact sections.

## 2. Data model

### 2.1 Per-user (persisted, LocalStorage key `deu:impact:v1`)
```jsonc
{
  "schemaVersion": 1,
  "tripId": "2026-04-13T09:12Z-abc",
  "generatedAt": "...",
  "route": { "countryCount": 7, "stopCount": 9, "totalKm": 4820 },
  "green": { "co2TrainKg": 168, "co2FlightKg": 1229, "co2SavedKg": 1061 },
  "economy": { "estSpendEUR": 980, "localShareEUR": 640 },
  "inclusion": {
    "accessibilityFiltersUsed": ["step-free","quiet-space"],
    "wheelmapLookups": 12,
    "lowBudgetMode": true
  },
  "culture": { "languagesTouched": ["de","cs","pl"], "languageCount": 3 },
  "engagement": { "bingoCompleted": 4, "daresCompleted": 7, "guidesOpened": 11 }
}
```

### 2.2 Ephemeral (never persisted)
Raw AI prompts, IP, timestamps beyond ISO date, anything resembling PII.

### 2.3 Opt-in snapshot (sent to aggregate — see §6)
Same shape **minus** `tripId`, rounded to 2 sig-figs where applicable, no free-text.

## 3. New files

| Path | Purpose |
|---|---|
| `js/features/impact.js` | Compute personal `ImpactReport` from current state |
| `js/features/impact-card.js` | PNG export (extends `wrapped.js` card engine) |
| `js/features/impact-aggregate.js` | Load `/data/impact-public.json`, render charts |
| `js/features/impact-optin.js` | Consent flow + snapshot serialiser |
| `js/ui/impact-panel.js` | In-app panel ("Your Impact" tab) |
| `pages/impact.html` | Standalone public dashboard route |
| `js/pages/impact-page.js` | Public page bootstrap |
| `data/impact-public.json` | Aggregated snapshot (CC-BY-4.0) |
| `data/impact-schema.json` | JSON Schema for both shapes |
| `i18n/en.json` (+5) | `impact.*` key family |
| `scripts/aggregate-impact.mjs` | Manual monthly freeze script (Node, dev-only) |

Reuse: `wrapped.js` canvas pipeline, `co2.js`, `seat-credits.js`, `pdf-export.js`.

## 4. i18n key family (`impact.*`)

`impact.title`, `impact.subtitle`, `impact.metric.countries`, `.km`, `.co2Saved`, `.localSpend`, `.languages`, `.accessibility`, `.bingo`, `impact.export.png`, `impact.export.json`, `impact.optin.title`, `impact.optin.what`, `impact.optin.notWhat`, `impact.optin.consent`, `impact.optin.revoke`, `impact.public.title`, `impact.public.cite`, `impact.empty`.

## 5. Routes & navigation

- In-app: new 9th tab **"Impact"** (icon: rising-line chart). Gated — empty-state prompts user to build a route first.
- Public: `/impact.html` — no-JS-fallback readable HTML with numbers inlined at freeze time; enhanced with charts if JS loads. Linked from footer and README.

## 6. Aggregation mechanism — **DECISION: Manual monthly freeze via PR**

Three options were considered:

| Option | Pros | Cons |
|---|---|---|
| Auto-POST to GitHub Gist | Live data | Needs token, PII risk, CORS/auth complexity, spam vector |
| Client-side P2P/CRDT | Fully decentralised | Out of scope, huge complexity |
| **Manual PR contribution** | Zero backend, reviewable, no secrets, auditable history, grant-reviewer friendly | Slower cadence, requires user action |

**Chosen:** Manual PR. User clicks *"Contribute my anonymised snapshot"* → app generates a pre-filled `gh` deep link (or a downloadable `snapshot-<hash>.json` + copy-to-clipboard) that opens a pre-populated PR against `data/contributions/`. Monthly, maintainer runs `scripts/aggregate-impact.mjs` to merge all `contributions/*.json` into `data/impact-public.json` and deletes raw files. Every aggregation is a git commit — fully auditable for EACEA.

Rationale: preserves the vanilla / no-backend / no-secrets constraints, gives reviewers a visible consent trail, and the PR-as-consent model is itself a Digital Participation story for the grant.

## 7. Privacy & opt-in UX

Two-step explicit consent, default OFF:

1. **First trigger** (user clicks "Share my impact"): modal lists exactly the fields in §2.3 with checkmarks, plus a *"What we never send"* list (names, route details, city stops, dates, IP, device). Copy references GDPR Art. 6(1)(a) consent.
2. **Confirmation**: user sees the JSON payload verbatim before submission. Buttons: *Review JSON*, *Copy*, *Open PR*, *Cancel*.
3. **Revoke**: one-click *"Delete my local impact data"* in Settings; PR-based contributions come with a self-declared `contribId` the user can later request removed via issue template.

No cookies. No analytics. No auto-send. No background sync.

## 8. Accessibility (WCAG AAA target)

- All numbers have text equivalents; charts have `<table>` data fallback.
- PNG export embeds alt-text as metadata + offers parallel plain-text summary copy-button.
- Contrast ≥ 7:1 on card (AAA); respect `prefers-reduced-motion` for counters.
- Keyboard: tab-order panel → metric cards → export buttons → consent toggle.
- Screen-reader: each metric wrapped in `<dl>` with `aria-describedby` for units.
- Public page: static HTML fallback means readable with JS off.

## 9. SW precache additions

`pages/impact.html`, `js/features/impact.js`, `js/features/impact-card.js`, `js/features/impact-aggregate.js`, `data/impact-public.json`, `data/impact-schema.json`. Aggregate JSON uses stale-while-revalidate so offline users see last-freeze numbers.

## 10. Grant narrative mapping

| Metric | Erasmus+ priority | Section it feeds |
|---|---|---|
| `co2SavedKg`, rail-vs-flight ratio | **Green** | KA220 Env. Sustainability, KA154 Green priority |
| `accessibilityFiltersUsed`, `wheelmapLookups`, `lowBudgetMode` adoption | **Inclusion** | KA220 Inclusion & Diversity (FO participants) |
| `languageCount`, `countryCount` | **Participation** | Sense of European belonging, intercultural competence |
| PR-based consent + open dataset + PWA | **Digital** | Digital transformation, open data, digital participation |
| Aggregate trip count, guide opens | Dissemination | "Reach" tables in every KA form |

Each `/impact` public metric has a `data-grant-priority` attribute so the grant-writer agent can scrape it straight into proposals.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Contributor floods PR queue | Rate-limit via per-browser nonce + maintainer review; template bot auto-validates against `impact-schema.json` |
| Re-identification via rare combos (e.g. 7 countries + language TR + wheelchair) | Aggregate script enforces k-anonymity (k≥5) — rare rows collapsed into "Other" |
| Estimated € spend is inaccurate | Label clearly as "estimated"; cite source (EU Youth Travel Survey) in tooltip |
| Users gaming metrics | Contributions are self-reported; doc limitation openly in dataset README (reviewers prefer honesty) |
| Schema drift | `schemaVersion` field + aggregate script rejects mismatches |

## 12. Out of scope (v1.4)

- Real-time live counter on public page (v1.5 candidate if a serverless relay is ever added).
- Cross-device sync of personal report.
- Comparative leaderboards / gamified ranking (conflicts with inclusion framing).
- Automated social-media posting.
- Mobile-app native share sheet (defer to Capacitor spin-off).

---
*End of spec — implementation plan to be drafted separately.*
