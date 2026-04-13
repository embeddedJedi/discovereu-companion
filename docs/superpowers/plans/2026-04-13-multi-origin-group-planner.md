# Multi-origin Group Planner (v1.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the multi-origin group trip planner described in the v1.7 design spec — a leader-created, URL-shared group (up to 10 travellers) that picks an optimal meeting point via the Weiszfeld geometric median, snaps it to a DiscoverEU-eligible city, and stitches per-member outbound/return legs around a shared middle section. No backend; state is exchanged as LZ-string–compressed URL hashes.

**Spec (authoritative, do NOT redesign):** [`docs/superpowers/specs/2026-04-13-multi-origin-group-planner-design.md`](../specs/2026-04-13-multi-origin-group-planner-design.md)

**Reference plans (format):**
- [`docs/superpowers/plans/2026-04-13-buddy-matching.md`](2026-04-13-buddy-matching.md)
- [`docs/superpowers/plans/2026-04-13-ai-intercultural-coach.md`](2026-04-13-ai-intercultural-coach.md)

**Architecture summary:** New `state.group` slice with persistence + migration and a 10-member cap. New pure-math module `js/features/meeting-point.js` (Weiszfeld + Haversine snap, zero DOM). New orchestrator `js/features/group-plan.js` wrapping create/add/remove/compute/encode/decode with LZ-string URL compression. Two UI modules (`js/ui/group-plan-panel.js`, `js/ui/group-member-form.js`) using `h()` only. Integration with existing `js/features/group-vote.js` to vote between 2–3 candidate meeting points. New standalone route (`pages/group.html` + `pages/group.js`) for invite links (`#/group?g=<lzstring>`). Route-builder gets a "Plan as group?" CTA gated on `state.user.groupSize > 1`. New stylesheet `css/group.css`. SW precache v12 → v13.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies (LZ-string already loaded), no build step, no backend, no PII in git.

**i18n path:** `js/i18n/i18n.js`. Source files under `i18n/*.json`. Ship en + tr; defer de/fr/es/it.

**Constraints carried forward from the spec:**
- **Member cap 10** (spec §3 allows 5 — we raise the internal cap to 10 to tolerate edits + removals without resharing; DiscoverEU rules still enforced at submission, not at state layer).
- **URL length budget < 2000 chars** for a full 10-member group. Short-key schema (`n`, `hc`, `p`, …) + bounded `preferences` fields. Warn at 4+ members. If the compressed URL exceeds 2000 chars, surface a dedicated error UI and log a followup for a **post-launch** Gist-fallback path (see §Deferred).

---

## Task 1: State slice — `state.group` + persistence + migration

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Default slice.** Extend the state factory:

```js
group: {
  id: null,                         // "grp_" + 8-char id, generated on first createGroup
  groupCode: null,                  // short human-friendly code for voice-sharing (e.g. "SKY-42-ROSE")
  leaderId: null,                   // memberId with authority on meetingPoint + sharedStops
  createdAt: null,                  // ISO
  members: [],                      // [{ id, displayName, homeCountry, homeCity: {name,lat,lon}, preferences }]
  meetingPoint: null,               // { cityId, lat, lon, snappedFrom: [lat,lon] } | null
  alternatives: [],                 // top-5 scored candidates from the optimizer (minus chosen)
  sharedStops: [],                  // cityIds reused from state.route.stops
  voteSession: null                 // { optionIds, votes: { [memberId]: optionId } } | null
}
```

- [ ] **Step 2: Constants + cap.** Export `GROUP_MAX_MEMBERS = 10`. All mutators enforce the cap.

- [ ] **Step 3: Persist + migrate.** Add `'group'` to `PERSIST_KEYS`. Hydrate with shape-merge so missing sub-keys receive defaults, unknown top-level keys drop. One-shot migration guard:

```js
if (!persisted.group || typeof persisted.group !== 'object') persisted.group = defaultGroup();
persisted.group = { ...defaultGroup(), ...persisted.group,
  members: Array.isArray(persisted.group.members) ? persisted.group.members.slice(0, GROUP_MAX_MEMBERS) : [] };
```

- [ ] **Step 4: Whitelist validation.**
  - `displayName` trimmed, max 40 chars, stripped of control chars.
  - `homeCountry` must be a valid ISO2 present in `countries.json`.
  - `homeCity.lat` ∈ [-90,90], `homeCity.lon` ∈ [-180,180].
  - `preferences.mobility` ∈ `['standard','reduced','wheelchair',null]`.
  - `preferences.pace` ∈ `['slow','balanced','fast',null]`.
  - `preferences.dietary` array of short tags, max 5 entries.
  - `preferences.maxBudgetEUR` integer 0..5000.
  - Invalid writes are rejected (leave state untouched, `console.warn`).

- [ ] **Step 5: Exports.** `setGroup(partial)`, `addGroupMember(member)`, `removeGroupMember(memberId)`, `updateGroupMember(memberId, patch)`, `setGroupMeetingPoint(mp, alternatives)`, `resetGroup()`. All dispatch the existing state-changed event.

- [ ] **Step 6: Browser smoke**

```js
const s = await import('./js/state.js');
s.resetGroup();
s.addGroupMember({ id:'mbr_1', displayName:'A', homeCountry:'DE', homeCity:{name:'Berlin',lat:52.52,lon:13.4}, preferences:{} });
console.assert(s.getState().group.members.length === 1, 'add failed');
for (let i = 0; i < 12; i++) s.addGroupMember({ id:'x'+i, displayName:'x', homeCountry:'FR', homeCity:{name:'P',lat:48.8,lon:2.3}, preferences:{} });
console.assert(s.getState().group.members.length <= 10, 'cap broken');
s.updateGroupMember('mbr_1', { preferences: { mobility: 'BOGUS' } });
console.assert(s.getState().group.members[0].preferences.mobility !== 'BOGUS', 'whitelist failed');
location.reload();
console.log('OK');
```

- [ ] **Step 7: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.7): state.group slice — members, meeting point, persistence + 10-member cap"
```

---

## Task 2: i18n — `group.*` keys (en + tr)

**Files:**
- Modify: `i18n/en.json` (source)
- Modify: `i18n/tr.json`
- Flag deferred: `de.json`, `fr.json`, `es.json`, `it.json`

- [ ] **Step 1: Add ~25 `group.*` leaves**:

```
group.title
group.subtitle
group.create
group.cap.warning
group.members.heading
group.members.empty
group.member.addCta
group.member.editCta
group.member.removeCta
group.member.leaderBadge
group.member.youAre
group.form.displayName
group.form.displayNameHint
group.form.homeCity
group.form.preferences
group.form.save
group.form.cancel
group.meetingPoint.heading
group.meetingPoint.suggestion
group.meetingPoint.savedKm
group.meetingPoint.alternatives
group.meetingPoint.putToVote
group.itinerary.heading
group.itinerary.leg.outbound
group.itinerary.leg.shared
group.itinerary.leg.return
group.share.button
group.share.copied
group.share.urlTooLong
group.share.privacyNote
group.conflict.calendar
group.invite.headline
group.invite.joinAs
group.invite.privacyNote
```

- [ ] **Step 2: Turkish translations** in `i18n/tr.json`. Preserve key paths exactly.

- [ ] **Step 3: PROGRESS.md followup** — log "Group Planner translations (de/fr/es/it)" under §7.

- [ ] **Step 4: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = [
  'group.title','group.create','group.member.addCta','group.meetingPoint.suggestion',
  'group.meetingPoint.putToVote','group.share.button','group.share.urlTooLong',
  'group.invite.joinAs','group.form.displayName'
];
const pick = (o,k) => k.split('.').reduce((a,p)=>a?.[p], o);
for (const [name, loc] of [['en',en],['tr',tr]]) {
  const miss = mustHave.filter(k => !pick(loc, k));
  console.assert(miss.length === 0, `${name} missing: ${miss.join(',')}`);
}
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.7): i18n keys for Group Planner (en + tr); de/fr/es/it deferred"
```

---

## Task 3: Pure math — `js/features/meeting-point.js`

**Files:**
- Create: `js/features/meeting-point.js`

- [ ] **Step 1: Exports (DOM-free, side-effect-free).**

```js
export function centroid(points);
// points: [{lat,lon}] → {lat,lon} (arithmetic mean)
export function weiszfeld(points, { maxIter = 50, eps = 1e-6 } = {});
// geometric median via Weiszfeld iteration (WGS84 treated as planar — acceptable for EU bbox)
export function haversineKm(a, b);
// standard Haversine, Earth radius 6371 km
export function snapToCity(latLon, cities);
// cities: [{cityId, name, countryId, lat, lon}] → { snappedCity, distanceKm }
export function computeOptimalMeetingPoint(memberHomes, cities);
// orchestrator: returns { optimalLatLng, snappedCity, totalDistanceKm, savedKmVsCentroid, top5 }
```

- [ ] **Step 2: Weiszfeld semantics.** Seed with centroid. Each iteration: new point = Σ(p_i / d_i) / Σ(1 / d_i). If any d_i < eps, that point contributes with a small floor (`d_i = eps`) to avoid division by zero. Stop when the step norm is below `eps` or `maxIter` reached.

- [ ] **Step 3: Snap fallback.** If the nearest eligible city is > 500 km from the geometric median (e.g. result lands in Atlantic, non-DiscoverEU area), return the nearest city to the **centroid** instead and flag `fallbackReason: 'out-of-bounds'` on the returned object.

- [ ] **Step 4: Scoring for top-5.** Rank candidate cities by `sum(haversineKm(home_i, candidate))` across all members. Output the winner + next 4 alternatives. (Cost/CO2/time refinement hooks are out of scope here — they stay in `group-plan.js`.)

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/meeting-point.js');
const pts = [{lat:52.52,lon:13.4},{lat:48.85,lon:2.35},{lat:41.9,lon:12.5}]; // Berlin/Paris/Rome
const g = m.weiszfeld(pts);
console.assert(Math.abs(g.lat - 47.7) < 2 && Math.abs(g.lon - 9.5) < 3, 'median off');
const cities = [
  { cityId:'vie', name:'Vienna', countryId:'AT', lat:48.21, lon:16.37 },
  { cityId:'mun', name:'Munich', countryId:'DE', lat:48.14, lon:11.58 },
  { cityId:'zrh', name:'Zurich', countryId:'CH', lat:47.37, lon:8.54 },
];
const r = m.computeOptimalMeetingPoint(pts, cities);
console.assert(r.snappedCity && r.totalDistanceKm > 0, 'snap failed');
console.assert(r.savedKmVsCentroid >= 0, 'saved km not computed');
console.assert(Array.isArray(r.top5), 'no alternatives list');
console.log('OK', r.snappedCity.name);
```

- [ ] **Step 6: Commit**

```bash
git add js/features/meeting-point.js
git commit -m "feat(v1.7): meeting-point — Weiszfeld geometric median + Haversine snap (DOM-free)"
```

---

## Task 4: Orchestrator — `js/features/group-plan.js`

**Files:**
- Create: `js/features/group-plan.js`
- Uses: `js/state.js`, `js/features/meeting-point.js`, LZ-string global, `data/countries.json`

- [ ] **Step 1: Exports.**

```js
export function createGroup({ leaderDisplayName, leaderHomeCity, leaderCountry, leaderPrefs } = {});
// seeds state.group with a leader member, id, groupCode, createdAt
export function addMember(member);
// wraps state addGroupMember + enforces 10-cap
export function removeMember(memberId);
// wraps state removeGroupMember; re-assigns leaderId if leader removed
export async function computeOptimalMeetingPoint();
// loads countries.json city list, runs meeting-point.computeOptimalMeetingPoint, writes state
export function encodeGroupUrl();
// returns { hash, length, warn } — LZ-compressed, short-key schema
export function decodeGroupUrl(hash);
// returns { ok, group, reason } — validated shape or { ok:false, reason }
export function mergeIncomingGroup(incoming);
// last-writer-wins per memberId; leader retains authority over meetingPoint + sharedStops
```

- [ ] **Step 2: Short-key schema** (URL budget). Encode members with `n` (name), `hc` (homeCountry), `la`/`lo` (lat/lon), `cn` (cityName), `p` (preferences object with equally short inner keys `mb`/`pc`/`dt`/`bd`). Top-level: `id`, `lid` (leaderId), `m` (members array), `mp` (meetingPoint), `ss` (sharedStops), `t` (createdAt millis, not ISO). Decoder re-expands to the full shape.

- [ ] **Step 3: URL compression.**

```js
const json = JSON.stringify(shortShape(state.group));
const hash = LZString.compressToEncodedURIComponent(json);
return { hash, length: hash.length, warn: hash.length > 1500 };
```

Hard fail at > 2000 chars: encoder returns `{ ok:false, reason:'url-too-long' }`; UI shows `group.share.urlTooLong`. (Fallback Gist path deferred; see §Deferred.)

- [ ] **Step 4: Merge semantics.**
  - Members are keyed by `id`; incoming member with same id overwrites local, else appended (up to cap).
  - `meetingPoint` and `sharedStops` only accepted from an incoming payload whose `lid === state.group.leaderId`.
  - If incoming `id !== state.group.id`, prompt the caller (UI decides) — do not merge silently.

- [ ] **Step 5: IDs.** `id = 'grp_' + randHex(8)`; `groupCode = pickWords(3)` (adjective-number-noun from a small built-in wordlist in this module — ~30 entries each; no new data file required); `memberId = 'mbr_' + randHex(6)`.

- [ ] **Step 6: Browser smoke**

```js
const gp = await import('./js/features/group-plan.js');
gp.createGroup({ leaderDisplayName:'A', leaderHomeCity:{name:'Berlin',lat:52.52,lon:13.4}, leaderCountry:'DE', leaderPrefs:{} });
gp.addMember({ id:'mbr_2', displayName:'B', homeCountry:'FR', homeCity:{name:'Paris',lat:48.85,lon:2.35}, preferences:{} });
gp.addMember({ id:'mbr_3', displayName:'C', homeCountry:'IT', homeCity:{name:'Rome',lat:41.9,lon:12.5}, preferences:{} });
await gp.computeOptimalMeetingPoint();
const s = (await import('./js/state.js')).getState();
console.assert(s.group.meetingPoint?.cityId, 'meeting point not set');
const enc = gp.encodeGroupUrl();
console.assert(enc.length > 0 && enc.length < 2000, 'url length out of budget');
const dec = gp.decodeGroupUrl(enc.hash);
console.assert(dec.ok && dec.group.members.length === 3, 'roundtrip failed');
console.log('OK', enc.length);
```

- [ ] **Step 7: Commit**

```bash
git add js/features/group-plan.js
git commit -m "feat(v1.7): group-plan — create/add/remove/compute + LZ URL encode/decode/merge"
```

---

## Task 5: Reusable member form — `js/ui/group-member-form.js`

**Files:**
- Create: `js/ui/group-member-form.js`
- Reuses: existing `home-city-picker.js` (home city geocoded pick)

- [ ] **Step 1: Exports.**

```js
export function mountGroupMemberForm(container, { initial = null, onSubmit, onCancel });
// returns { destroy }
```

- [ ] **Step 2: Structure (all via `h()`).**
  - `<form role="group" aria-labelledby>` with fieldset + legend.
  - Display name `<input>` — required, maxlength 40, labelled, `aria-describedby` hint.
  - Home city picker component (mounted slot — reuse `home-city-picker.js`).
  - Preferences collapsible group: mobility radio group, pace radio group, dietary tag input (max 5), budget number (0..5000).
  - Submit + Cancel buttons; `Enter` submits, `Esc` cancels.
  - Error summary region at top (`role="alert"`) listing invalid fields by label.

- [ ] **Step 3: Validation.** Mirrors Task 1 whitelist. On invalid submit, focus moves to the error summary, each invalid field gets `aria-invalid="true"`.

- [ ] **Step 4: A11y.** All inputs labelled; visible focus ring via `--focus` token; reduced-motion respected; colour is never the sole error signal (icon + text).

- [ ] **Step 5: Browser smoke**

```js
const { mountGroupMemberForm } = await import('./js/ui/group-member-form.js');
const host = document.createElement('div'); document.body.append(host);
let submitted;
const { destroy } = mountGroupMemberForm(host, { onSubmit: m => { submitted = m; }, onCancel: () => {} });
host.querySelector('input[name="displayName"]').value = 'Test';
host.querySelector('input[name="displayName"]').dispatchEvent(new Event('input'));
// Simulate home city pick via test hook (or skip and stub state):
host.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
console.assert(host.querySelector('[role="alert"]') || submitted, 'form not wired');
destroy(); host.remove();
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/group-member-form.js
git commit -m "feat(v1.7): group-member-form — accessible add/edit form with home-city-picker reuse"
```

---

## Task 6: Main panel — `js/ui/group-plan-panel.js`

**Files:**
- Create: `js/ui/group-plan-panel.js`

- [ ] **Step 1: Exports.**

```js
export function openGroupPlanPanel({ focus = 'members' } = {});
export function closeGroupPlanPanel();
```

- [ ] **Step 2: Structure (all via `h()`).**
  - Overlay `.gp-panel` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
  - Header: title + close button + "You are: {displayName}" banner sourced from self-id stored in `localStorage` keyed by `group.id`.
  - Section **Members** — list of member cards, each with:
    - Display name + home city label + leader badge (if `memberId === state.group.leaderId`).
    - Edit button (opens `group-member-form` inline) + Remove button (leader-only, confirm).
    - "Add member" button → opens empty `group-member-form`.
    - Cap warning via `group.cap.warning` at 4+ members.
  - Section **Meeting point** — big suggestion card:
    - Map marker snippet + city name + country flag.
    - `group.meetingPoint.savedKm` line.
    - Alternatives list (top-3 incl. chosen) as a radio group.
    - "Put to vote" button (task 7 integration).
  - Section **Integrated itinerary** — per-member timeline: outbound leg (home → meeting point), shared middle, return leg (meeting point → home). Collapsible per member.
  - Section **Calendar conflicts** — red/icon banner if any blackoutDate intersects the shared window (minimal check: skip if blackoutDates absent).
  - Footer: **Share** button (Task 4 `encodeGroupUrl` + `navigator.clipboard.writeText`), share-URL text readout, privacy note (`group.share.privacyNote`).

- [ ] **Step 3: A11y.** Focus trap, `Esc` closes, `aria-live="polite"` announces optimizer result ("Meeting point: Vienna, saves 240 km"), keyboard-operable alternatives radio group.

- [ ] **Step 4: State reactions.** Subscribe to state-changed; re-render only the section whose slice changed (members section vs meeting-point section) via per-section keyed containers.

- [ ] **Step 5: Browser smoke**

```js
const { openGroupPlanPanel } = await import('./js/ui/group-plan-panel.js');
openGroupPlanPanel();
const dlg = document.querySelector('.gp-panel[role="dialog"]');
console.assert(dlg, 'panel not mounted');
console.assert(dlg.querySelector('[data-section="members"]'), 'members section missing');
console.assert(dlg.querySelector('[data-section="meeting-point"]'), 'meeting-point section missing');
console.assert(dlg.querySelector('[data-action="share"]'), 'share button missing');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/group-plan-panel.js
git commit -m "feat(v1.7): group-plan-panel — members + meeting-point + itinerary + share UI"
```

---

## Task 7: Integration — reuse `group-vote.js` for meeting-point vote

**Files:**
- Modify: `js/features/group-vote.js`

- [ ] **Step 1: Extend `group-vote.js` API** to accept generic options (previously route-vote specific):

```js
export function startVote({ kind, options, voterIds });
// kind ∈ {'route','meeting-point'}; options: [{id, label, meta}]
export function castVote(memberId, optionId);
export function closeVote();
export function getResult(); // {winner, tally, ties}
```

- [ ] **Step 2: Plumb into panel.** "Put to vote" button in the panel's meeting-point section passes `{ kind: 'meeting-point', options: [chosen, ...top3Alternatives].slice(0,3).map(c => ({ id: c.cityId, label: c.name, meta: { km: c.totalDistanceKm } })), voterIds: state.group.members.map(m => m.id) }` and writes the result back into `state.group.meetingPoint` on close.

- [ ] **Step 3: Preserve route-vote callers.** If any existing call site passes the old signature, branch on presence of `kind`. Add a one-line compat shim; do not break v1.5 vote UI.

- [ ] **Step 4: Browser smoke**

```js
const v = await import('./js/features/group-vote.js');
v.startVote({ kind:'meeting-point', options:[{id:'vie',label:'Vienna'},{id:'mun',label:'Munich'}], voterIds:['m1','m2','m3'] });
v.castVote('m1','vie'); v.castVote('m2','vie'); v.castVote('m3','mun');
console.assert(v.getResult().winner === 'vie', 'winner wrong');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/features/group-vote.js
git commit -m "feat(v1.7): group-vote — generic options API; reused for meeting-point vote"
```

---

## Task 8: Standalone route — `pages/group.html` + `pages/group.js`

**Files:**
- Create: `pages/group.html`
- Create: `pages/group.js`
- Modify: `js/router.js` (register `#/group?g=<lzstring>` or `/group?g=...` depending on existing router convention)

- [ ] **Step 1: `pages/group.html`.** Minimal scaffolding matching existing `pages/*.html` siblings: same `<head>`, same CSS links, `<main id="group-root">`, loads `pages/group.js` as an ES module. Leader-follower merge happens in the page script, not in HTML.

- [ ] **Step 2: `pages/group.js`.** On boot:
  1. Parse `g` query param.
  2. If absent → render "Create a group" CTA that calls `createGroup()` then `openGroupPlanPanel()`.
  3. If present → `decodeGroupUrl(g)`:
     - If decode fails → user-visible error, link back to route-builder.
     - If `incoming.id === state.group.id` → `mergeIncomingGroup(incoming)` + open panel.
     - Else → "You've been invited" prompt with **Join as member** button → opens `group-member-form`; on submit, adopt the incoming group id, add self, re-encode, update hash, open panel.
  4. Persist self-id (memberId of the joining user) in `localStorage` keyed by `group.id` for the "You are: X" banner.

- [ ] **Step 3: Router wiring.** Match the existing router style (hash-based or query-based per `js/router.js`) — do not invent a new convention.

- [ ] **Step 4: Browser smoke**

```js
// From route-builder page:
const gp = await import('./js/features/group-plan.js');
gp.createGroup({ leaderDisplayName:'A', leaderHomeCity:{name:'Berlin',lat:52.52,lon:13.4}, leaderCountry:'DE', leaderPrefs:{} });
gp.addMember({ id:'mbr_2', displayName:'B', homeCountry:'FR', homeCity:{name:'Paris',lat:48.85,lon:2.35}, preferences:{} });
const { hash } = gp.encodeGroupUrl();
location.href = `pages/group.html?g=${hash}`;
// On the group page:
await new Promise(r => setTimeout(r, 500));
console.assert(document.querySelector('.gp-panel[role="dialog"]') || document.querySelector('[data-action="join-as-member"]'), 'page did not route');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add pages/group.html pages/group.js js/router.js
git commit -m "feat(v1.7): /group standalone route — invite link decode + join-as-member flow"
```

---

## Task 9: Integration — route-builder "Plan as group?" CTA

**Files:**
- Modify: `js/ui/route-builder.js`

- [ ] **Step 1: Locate render point.** Near the existing group-size / companion controls. If `state.user.groupSize > 1` (or group slice has any members), render an inline CTA:

```js
const cta = h('button', {
  type:'button', class:'gp-cta', 'data-action':'open-group-planner',
  onclick: () => import('./group-plan-panel.js').then(m => m.openGroupPlanPanel())
}, t('group.title'));
```

- [ ] **Step 2: Do not re-render** the CTA on every state change — idempotent mount via a dedicated slot element.

- [ ] **Step 3: Browser smoke**

```js
// Set groupSize > 1 in settings, then:
const btn = document.querySelector('[data-action="open-group-planner"]');
console.assert(btn, 'CTA missing');
btn.click();
await new Promise(r => setTimeout(r, 50));
console.assert(document.querySelector('.gp-panel[role="dialog"]'), 'panel did not open');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/ui/route-builder.js
git commit -m "feat(v1.7): route-builder — Plan as group? CTA when groupSize > 1"
```

---

## Task 10: CSS — `css/group.css`

**Files:**
- Create: `css/group.css`
- Modify: `index.html` (add `<link rel="stylesheet" href="css/group.css">`)
- Modify: `pages/group.html` (same link)

- [ ] **Step 1: Classes.** `.gp-panel`, `.gp-member-list`, `.gp-member-card`, `.gp-leader-badge`, `.gp-meeting-card`, `.gp-alternatives`, `.gp-timeline`, `.gp-share-button`, `.gp-cta`, `.gp-conflict-banner`, `.gp-you-are`.

- [ ] **Step 2: Tokens only.** Never hardcode colours — use `--surface`, `--text`, `--accent`, `--focus`, `--border`, `--danger`, plus existing dark/light custom properties from `css/design-system.css`.

- [ ] **Step 3: Behaviour.**
  - `@media (prefers-reduced-motion: reduce)` disables transitions.
  - Focus ring `outline: 3px solid var(--focus); outline-offset: 2px`.
  - Mobile-first: full-screen panel at ≤ 768px, right side-panel (520px) above.
  - Minimum 56×56 px tap targets for member-card actions + Share button.
  - `.gp-leader-badge` uses icon + text (colour not sole indicator).
  - Map-card aspect ratio preserved at narrow widths (no horizontal scroll).

- [ ] **Step 4: Browser smoke**

```js
console.assert([...document.styleSheets].some(x => (x.href||'').endsWith('group.css')), 'group.css not linked');
const probe = document.createElement('div'); probe.className = 'gp-panel'; document.body.append(probe);
const cs = getComputedStyle(probe);
console.assert(cs.position !== 'static', 'gp-panel styling not applied');
probe.remove();
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add css/group.css index.html pages/group.html
git commit -m "feat(v1.7): group.css — panel, member cards, meeting-point, timeline, share button"
```

---

## Task 11: Service worker precache bump (v12 → v13)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version.**

```js
const CACHE_VERSION = 'discovereu-v13';
```

- [ ] **Step 2: Append to same-origin precache manifest.**

```
'pages/group.html',
'pages/group.js',
'css/group.css',
'js/features/meeting-point.js',
'js/features/group-plan.js',
'js/ui/group-plan-panel.js',
'js/ui/group-member-form.js'
```

`countries.json` should already be precached from earlier versions — verify, do not duplicate. LZ-string CDN URL is cross-origin and stays out of precache (already loaded at top-level page).

- [ ] **Step 3: Browser smoke (airplane-mode cold load).**

```js
const c = await caches.open('discovereu-v13');
for (const p of ['pages/group.html','pages/group.js','css/group.css','js/features/meeting-point.js','js/features/group-plan.js','js/ui/group-plan-panel.js']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
console.log('OK');
```

Then DevTools → Network → Offline → hard reload → open `pages/group.html?g=...`: panel chrome must render fully (countries.json served from earlier precache).

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(v1.7): sw cache v13 — precache Group Planner assets"
```

---

## Task 12: Final smoke + PROGRESS.md + decision log

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full route-level smoke.**

1. Clear SW caches + localStorage + IndexedDB.
2. Hard reload; confirm state migration adds `state.group` cleanly.
3. Go to settings; set `groupSize = 3`. Route-builder shows "Plan as group?" CTA.
4. Click CTA → panel opens; add leader (self) + 2 members from different countries.
5. Click "Compute meeting point" → suggestion card shows snapped city + saved-km line + alternatives.
6. Click "Put to vote" → 3 candidates listed → each member votes → winner writes back into `state.group.meetingPoint`.
7. Click "Share" → URL copied; length < 2000 chars.
8. Open the URL in a fresh incognito tab → "You've been invited" prompt → join as 4th member → panel repopulates with all 4 members.
9. Keyboard-only pass: Tab/Enter through members + alternatives + share; `Esc` closes; focus returns to opener.
10. DevTools → Network → Offline: panel chrome still loads (SW v13). LZ-string remains loaded (top-level CDN script).
11. Lighthouse accessibility pass on open panel — target ≥ 95.
12. Edge case: add members until 10; 11th add call rejected, cap warning surfaced.
13. Edge case: simulate URL > 2000 chars (add long displayName + all preferences on every member) → `group.share.urlTooLong` banner surfaced; copy button disabled.

- [ ] **Step 2: Update PROGRESS.md.**
- Move every Group Planner entry to `Done` under §5.
- Add decision entry under §6:

```
**Decision (2026-04-13):** Multi-origin Group Planner uses LZ-string–compressed URL hashes as the zero-backend sync channel, with a 10-member cap and a Weiszfeld geometric median snapped to a DiscoverEU-eligible city.
**Context:** v1.7 needs cross-border peer co-planning without any backend or account.
**Alternatives considered:** Firebase realtime DB (violates no-backend constraint), GitHub Issues backplane (too noisy — each edit would spam an issue), Y.js CRDT over WebRTC (signalling still needs a server).
**Rationale:** URL-as-state is auditable by EACEA reviewers, works offline after first load, and keeps privacy posture (no PII in git, no server). Weiszfeld is O(iter·n) and converges in < 50 iterations for EU-sized inputs. Snap-to-city step guarantees the result is a DiscoverEU-eligible destination even if the raw median lands in water.
**Consequences:** URL length must stay < 2000 chars — mitigated by short-key schema, 10-member cap (DiscoverEU still enforces 5 at submission), bounded `preferences` fields, and a hard error banner above 2000. Gist-fallback for oversized groups deferred post-launch.
```

- Add followups to §7:
  - Group Planner translations de/fr/es/it.
  - Gist-fallback for URL > 2000 chars (post-launch).
  - Per-member CO2 / cost / time refinement in `group-plan.js` using `co2.js` + `effective-legs.js` + `seat-credits.js` (currently the optimizer ranks on pure distance).
  - Calendar-conflict richer UX (blackoutDates input form).
  - Impact Dashboard `groupMode` stacked bars (spec §5).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.7): mark Group Planner complete; log LZ-URL-backplane decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §1 problem — groups live in different countries, need shared plan | Tasks 3, 4, 6 |
| §2 leader creates, shares LZ URL, members append, recompute | Tasks 4, 6, 8 |
| §3 `state.group` data model (id, leaderId, members, meetingPoint, sharedStops, voteSession) | Task 1 |
| §4 meeting-point optimizer — Weiszfeld + snap + score top-5 | Task 3 (+ Task 4 orchestration) |
| §4 snap fallback if median > 500 km from any city | Task 3 Step 3 |
| §5 per-member leg computation (home → MP → shared → MP → home) | Task 6 (itinerary section); refinement with co2/seat-credits deferred (§7 followup) |
| §6 left-rail Group tab behind `groupSize > 1` | Task 9 |
| §6 members list, meeting point card, vote CTA, per-member summary, calendar conflicts | Task 6 |
| §6 keyboard + `aria-live` announce optimizer result | Task 6 Step 3 |
| §7 share flow — encode → `location.hash` → router detects → merge or prompt join | Tasks 4, 8 |
| §7 last-writer-wins per memberId; leader authority on MP + sharedStops | Task 4 Step 4 |
| §7 URL budget < 2000 chars, short-key schema | Task 4 Step 2–3 |
| §8 i18n `group.*` (en + TR ship; DE/FR/ES/IT deferred) | Task 2 |
| §9 a11y: labelled inputs, error summary, aria-live optimizer progress, alternatives radio group, colour-not-sole | Tasks 5, 6, 10 |
| §10 privacy — user-chosen alias, no email/phone, city-level only, privacy note before first share | Tasks 1 (validation), 5, 6 (privacy note in share footer) |
| §11 grant narrative (KA220-YOU Participation) | PROGRESS decision log (Task 12) |
| §12 risks — URL length, conflicting edits, identity confusion, ocean-median, stale URL | Tasks 4, 6, 8 |
| §13 out-of-scope — realtime sync, chat, push, payment-split, verification, persistent accounts | Not implemented (by design) |
| §14 files — new `js/features/group-plan.js`, `js/ui/group-plan-panel.js`, i18n files; modified `state.js`, `router.js`, `group-vote.js` | Tasks 1, 2, 4, 6, 7, 8 |

All in-scope spec requirements map to at least one task. Out-of-scope items (§13) are explicitly not implemented.

### Deferred (post-launch)

- **i18n locales deferred:** `de`, `fr`, `es`, `it`. Logged as PROGRESS §7 followup in Task 12.
- **Gist-fallback for oversized URLs** (> 2000 chars). Rationale: requires a user-provided GitHub PAT + Gist API call, violates the zero-user-data posture without consent UI, and only triggers on the extreme-edge 10-member-max-preferences case. Logged as a PROGRESS §7 followup; the v1.7 PR ships the hard-error banner instead.
- **co2/cost/time refinement** in the scoring function (currently pure Haversine distance). Hook is in `group-plan.js`; refactor deferred so v1.7 ships with a predictable, test-friendly metric.
- **Impact Dashboard `groupMode`** stacked bars. Spec §5 foreshadows but the impact-dashboard changes are tracked as a followup to keep v1.7 scope surgical.

### URL length concern — concrete mitigations shipped in this plan

1. **10-member cap** enforced at state layer (Task 1 Step 2) and orchestrator (Task 4 Step 1).
2. **Short-key schema** (`n`, `hc`, `la`, `lo`, `p`, `mb`, `pc`, …) cuts JSON size ~45 % before LZ (Task 4 Step 2).
3. **Bounded preferences** — dietary max 5 tags, displayName max 40 chars, integer budget (Task 1 Step 4).
4. **LZ-string `compressToEncodedURIComponent`** — already loaded on the page, no new CDN import.
5. **Warn threshold at 1500 chars**, hard fail at 2000 with `group.share.urlTooLong` banner and disabled copy button (Task 4 Step 3).
6. **Gist fallback** explicitly deferred and logged as a post-launch followup so v1.7 stays a single-file-share shipment.

---

## CRITICAL — invariants for v1.7

1. LZ-string is loaded as a top-level CDN script in both `index.html` and `pages/group.html`. The group-plan module assumes `window.LZString` is defined — do not dynamically import a clone.
2. `state.group.id` is the identity key for merges. Regenerating the id invalidates every previously shared URL — never regenerate implicitly.
3. `countries.json` must expose the DiscoverEU-eligible city list the snap step uses. If the schema does not currently expose per-city `{cityId, name, countryId, lat, lon}`, Task 3 Step 5 smoke will fail — coordinate with data-curator BEFORE starting Task 3. (If schema gap is confirmed, add a pre-task to extend `countries.json` and bump its loader, then proceed.)
4. Service worker same-origin rule preserved — no `api.github.com` or `cdn.jsdelivr.net` entries added to the precache manifest.
