# v1.7 — Multi-origin Group Planner (Design Spec)

**Date:** 2026-04-13
**Pivot track:** Erasmus+ KA220-YOU *Cooperation partnerships in youth* — Priority: **Participation & Engagement**
**Status:** Design approved, pending implementation

---

## 1. Problem

DiscoverEU permits groups of up to 5 travellers. Today our app assumes a single `state.user.homeCity`. Real groups live in different countries. They need a shared plan that (a) picks a sensible meeting point, (b) stitches per-member outbound/return legs around a shared middle section, and (c) respects each member's calendar constraints.

## 2. Solution summary

Leader creates a group in the browser, shares an LZ-string URL, each member opens it, appends their home city + preferences, and the app recomputes an optimal meeting point plus per-member legs. No backend; state is exchanged by re-sharing the updated URL.

## 3. Data model

New slice `state.group`:

```
state.group = {
  id: "grp_" + nanoid(8),
  leaderId: "mbr_xxx",
  createdAt: ISO,
  members: [
    {
      id: "mbr_xxx",
      displayName: string,        // user-chosen alias, no PII
      homeCountry: ISO2,
      homeCity: { name, lat, lon },
      preferences: { maxBudgetEUR, mobility, dietary, pace },
      calendar: { earliestStart, latestEnd, blackoutDates[] }
    }
  ],
  meetingPoint: { cityId, lat, lon, snappedFrom: [lat, lon] } | null,
  sharedStops: [cityId, ...],     // middle-section, reused from state.route.stops
  voteSession: { optionIds, votes{memberId: optionId} } | null
}
```

Single source of truth remains `state.js`; `state.route` stays untouched for solo use.

## 4. Meeting-point optimizer (`js/features/group-plan.js`)

- Input: `members[].homeCity` coords.
- Step 1 — **Geometric median** (Weiszfeld iteration, 50 iter, eps 1e-6) over WGS84 treated as planar (acceptable for EU bbox).
- Step 2 — **Snap** to nearest DiscoverEU-eligible city from `data/countries.json` (cities already geocoded). Haversine distance.
- Step 3 — **Score candidates** (top 5 nearest): sum of per-member CO2 + travel-time + cost from `co2.js` / `effective-legs.js` / `seat-credits.js`. Lowest aggregate wins; others become alternatives for group vote.
- Output: `{ chosen, alternatives[], perMemberCosts }`.

## 5. Leg computation

For each member: `home → meetingPoint → sharedStops[] → meetingPoint → home`.
- Outbound + return legs reuse v1.2 `state.route.returnStops` logic (`includeReturnInBudget = true`).
- Shared middle legs computed once, then divided equally into per-member CO2/cost share (configurable: equal-split vs per-seat-credit).
- v1.4 Impact Dashboard gets a `groupMode` prop: stacked bars, one per member; aggregate line for total.

## 6. UI (`js/ui/group-plan-panel.js`)

New left-rail tab **"Group"** (behind `state.user.groupSize > 1`).
Sections:
1. **Members list** — add/edit/remove cards; leader-only removal; "Invite via link" → generates `#/group?g=<lz>`.
2. **Meeting point** — map marker + alternatives list + "Put to vote" button (reuses `group-vote.js`).
3. **Per-member summary** — mini Impact cards.
4. **Calendar conflicts** — red banner if any member's `blackoutDates` overlap the proposed window.

Keyboard: full tab order through member cards; `Enter` submits, `Esc` cancels; `aria-live="polite"` region announces optimizer result ("Meeting point: Vienna, saves 240 kg CO2 vs. farthest option").

## 7. Share flow

- Leader clicks **Share group** → `encodeGroupState(state.group)` → LZ-string compress → `location.hash = "#/group?g=" + encoded`.
- Router (`js/router.js`) detects `#/group?g=`; if local `state.group.id` matches, merges; else prompts "Join this group as member?" and appends new member.
- Updated URL re-copied after each append. Conflict resolution: **last-writer-wins per member id**; leader has authority on `meetingPoint` and `sharedStops`.
- URL length budget: target <2000 chars for 5 members; schema uses short keys (`n`, `hc`, `p`) to stay under.

## 8. i18n

Key family `group.*`: `group.title`, `group.addMember`, `group.meetingPoint`, `group.optimizer.running`, `group.optimizer.result`, `group.conflict.calendar`, `group.share.copied`, `group.vote.cta`. English source + TR/DE/FR/ES translations.

## 9. Accessibility

- All form inputs labelled; error summary at top on submit.
- Optimizer runs in a worker-like async chunk; progress announced via `aria-live`.
- Map markers have text fallbacks in the alternatives list (keyboard-operable radio group).
- Color is never the sole signal for conflicts — icon + text.

## 10. Privacy

- `displayName` is user-chosen alias; placeholder suggests "Traveller A".
- No email, no real name, no photo.
- Home city is city-level only (no street). Shared URL contains only what the leader shared.
- Privacy note surfaced in UI before first share.

## 11. Grant narrative (KA220-YOU Participation)

- **Participation:** lowers threshold for cross-border peer groups — youth from different member states co-plan without a backend or account.
- **Inclusion:** members with fewer opportunities can join a group led by a more experienced peer; meeting-point optimizer accounts for mobility preferences.
- **Active European citizenship:** concrete cross-border collaboration artefact (the shared URL) demonstrates intercultural cooperation.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| URL length > 2000 chars | Short-key schema; warn at 4 members; offer QR code |
| Conflicting edits by two members at once | Last-writer-wins + visible "last updated by" per field |
| User identity confusion (which member am I?) | Self-id stored in `localStorage` per group id; "You are: Traveller B" banner |
| Geometric median lands in Atlantic / non-DiscoverEU area | Snap step guarantees eligible city; fallback to centroid if snap >500 km |
| Member opens stale URL | `createdAt` + version check; prompt to reload latest |

## 13. Out of scope

Real-time sync; in-app chat; push notifications; payment splitting; group identity verification; persistent group accounts.

## 14. Files touched

- **New:** `js/features/group-plan.js`, `js/ui/group-plan-panel.js`, `i18n/*/group.json`
- **Modified:** `js/state.js` (add `group` slice), `js/router.js` (`#/group?g=`), `js/ui/impact-dashboard.js` (groupMode), `js/features/group-vote.js` (accept meeting-point options)
- **Unchanged:** `co2.js`, `seat-credits.js`, `effective-legs.js`, `countries.json`

## 15. Complexity

Medium-large. Estimated 18-22 tasks across feature-engineer + ui-designer + map-specialist.
