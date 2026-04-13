# contributions/

User-contributed anonymised data for DiscoverEU Companion's open public
datasets. Nothing here is PII — everything passes through a k-anonymity
whitelist before it can be exported from the app.

## How to contribute an impact snapshot

1. Open the app and navigate to the **Impact** tab. Opt in (default is OFF —
   no data leaves your device without explicit two-step consent).
2. Use **Export snapshot JSON** to download your anonymised impact file.
   Only whitelisted numeric fields survive (`js/features/impact-anonymize.js`);
   names, exact locations, timestamps, and free-text are never included.
3. Open a pull request against this repository adding your file to
   `contributions/impact/<any-unique-name>.json`. The in-app button
   pre-fills a GitHub "new file" URL for you.
4. The maintainer reviews and merges. Once per month the freeze script
   (`scripts/freeze-impact.mjs`) aggregates all merged contributions with
   `k >= 5` anonymity and publishes the result to `data/impact-public.json`
   under CC-BY-4.0. Raw contribution files are deleted in the same commit —
   only the aggregate survives.

Your PR is your consent. You can revoke at any time by opening a new PR that
removes your file (or emailing the maintainer); a future freeze will reflect
the removal.
