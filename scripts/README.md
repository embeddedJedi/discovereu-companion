# scripts/

Maintainer-run utilities for DiscoverEU Companion. **Not shipped to users** —
these are developer/ops tools executed locally before a release or after
merging user-contributed content.

Node >= 20. Zero dependencies. Pure ESM.

---

## freeze-impact.mjs — monthly impact dataset freeze

Aggregates anonymised impact snapshots contributed by users (via pull request)
into a single public dataset and rewrites the static FROZEN numbers inside
`pages/impact.html` so the dashboard works with JavaScript disabled.

### Workflow

1. **Users opt in** inside the app. Nothing leaves the device until the user
   explicitly exports an anonymised snapshot JSON.
2. **Users submit a PR** against this repository, adding their snapshot as a
   new file under `contributions/impact/<id>.json`. The file matches the
   envelope:

   ```json
   {
     "contribution": {
       "version": "impact-contribution/1.0",
       "submittedAt": "2026-04-12",
       "anonymizedSnapshot": { "personal": { /* ... */ }, "meta": { /* ... */ } }
     }
   }
   ```

3. **Maintainer reviews and merges** the PR. Merging the PR is the consent
   act — no cookies, no analytics, no backend.
4. **Maintainer runs the freeze script**:

   ```bash
   node scripts/freeze-impact.mjs            # real run
   node scripts/freeze-impact.mjs --dry-run  # log-only, no writes
   ```

5. The script:
   - Reads every `contributions/impact/*.json`.
   - Validates each envelope shape (rejects the run if any file is malformed).
   - Normalises each snapshot through the whitelist in
     `js/features/impact-anonymize.js` (defence in depth — the client already
     anonymised but we re-enforce).
   - Runs `mergeContributions(records, { k: 5 })` — records whose quasi-
     identifier fingerprint appears fewer than 5 times are dropped; histogram
     bins with fewer than 5 entries are suppressed.
   - Writes `data/impact-public.json` (CC-BY-4.0, pretty-printed).
   - Rewrites the `<!-- BEGIN:FROZEN --> ... <!-- END:FROZEN -->` block in
     `pages/impact.html` with the new numbers and flips
     `data-source="seed"` to `data-source="frozen"`.
   - Logs a summary (input count, aggregate highlights, which anonymity
     thresholds were triggered).

6. **Maintainer commits** the updated `data/impact-public.json` and
   `pages/impact.html`, and deletes the raw files in `contributions/impact/`
   in the same commit (spec §6 — raw contributions are not retained).

### Safety

- Refuses to run if `contributions/impact/` does not exist.
- Refuses to run if any contribution file has an unexpected envelope shape.
- `--dry-run` logs every step and what _would_ be written without touching
  disk — use this before any real freeze to sanity-check the inputs.
- The aggregator enforces `k = 5` as a hard constant. If you need to relax
  this (not recommended), edit the script explicitly — it is not a CLI flag
  on purpose.

### What gets published

Only whitelisted numeric fields survive the anonymiser. See
`js/features/impact-anonymize.js` → `PERSONAL_WHITELIST`. Everything else is
dropped silently. Free-text, timestamps, names, emails, exact coordinates, and
route geometry are **never** in the public dataset.
