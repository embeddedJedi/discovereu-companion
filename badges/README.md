# badges/

Public OpenBadge 2.0 assets for the DiscoverEU Companion **Intercultural Coach** micro-credential.

## Why this directory is public

OpenBadge 2.0 hosted verification (`"verification": { "type": "hosted" }`) requires that the Issuer Profile and each BadgeClass be retrievable over HTTPS at a stable, canonical URL. GitHub Pages serves this directory at:

```
https://embeddedjedi.github.io/discovereu-companion/badges/
```

Europass, Badgr, and other OBv2-compliant wallets dereference these URLs to verify a learner's assertion.

## Contents

| Path | Purpose |
|---|---|
| `issuer.json` | Issuer Profile — identity of DiscoverEU Companion as a credential issuer |
| `classes/{cc}.json` | One BadgeClass per DiscoverEU-eligible country (34 files, lowercase ISO 3166-1 alpha-2) |
| `images/{cc}.svg` | Per-country badge artwork (deferred — see `images/.gitkeep`) |
| `images/issuer-logo.png` | Issuer logo (deferred) |

The file `data/coach-badge-issuer.json` is a byte-identical mirror of `issuer.json` used by the in-app coach module; both files must stay in sync.

## Schema version

OpenBadge **2.0** — <https://w3id.org/openbadges/v2>

The DiscoverEU Companion intended upgrade to OBv3 (Verifiable Credentials) is tracked as a post-v1.6 item.

## Regenerating BadgeClass files

The 34 per-country BadgeClass JSONs are generated from `data/countries.json` by:

```bash
node scripts/gen-badge-classes.mjs            # writes/overwrites classes/*.json
node scripts/gen-badge-classes.mjs --dry-run  # logs only, no writes
```

The generator is pure ESM, has no npm dependencies, and is deterministic — re-running it on an unchanged `countries.json` produces byte-identical output (no timestamps).

## Country list

The generator filters `data/countries.json` to the 34 DiscoverEU-eligible ISO codes:

```
AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL
PL PT RO SK SI ES SE IS LI NO MK RS TR
```

(33 DiscoverEU + TR bonus layer.)

## License

All JSON in this directory is released under the project MIT license. Badge artwork (once added) will follow the same license unless stated otherwise in the file header.
