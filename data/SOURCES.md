# Data Sources & Attribution

## Sub-project 1 sources (2026-04-11)

- **ILGA-Europe Rainbow Europe 2025** (annual report) — `https://www.ilga-europe.org/report/rainbow-europe-2025/` — LGBTQ+ rights scores for `data/rainbow-map.json`. Refreshed annually each May.
- **Wheelmap.org** (OSM-derived, CC BY-SA) — `https://wheelmap.org` — accessible venue counts for `data/accessibility.json`. EU Disability Card pilot metadata supplemented from `ec.europa.eu`.
- **EU 112 emergency registry** — `https://112.eu` — universal emergency number + per-country overrides for `data/emergency-phrases.json`. Phrase translations hand-authored by native speakers.

## Sub-project 2 sources (2026-04-12)

- **Wikivoyage** (CC BY-SA 3.0) — `https://en.wikivoyage.org/` — country + city guide text for `data/guides.json`. Attribution preserved in each entry's `sourceUrl` field. Refreshed annually.
- **Spotify** — `https://open.spotify.com/genre/charts-regional` — regional Top 50 editorial playlist IDs for `data/soundtracks.json`. Embedded via iframe; playback governed by Spotify's own terms.
- **Groq** — `https://console.groq.com/` — Llama 3.1 70B Versatile model used for natural-language route suggestion. User provides their own API key; no proxy.
- **VFS Global / iDATA / TLScontact / BLS** — consulate application centre addresses in Turkiye for `data/tr-consulates.json`. Sourced from each provider's public Turkiye portal; providers occasionally change contracts so refresh quarterly.

## Core data sources (2026-04-10)

- **Natural Earth** (public domain) — `https://www.naturalearthdata.com/` — 1:50m country boundaries for `data/geojson/europe.geojson`. Simplified to 36 European features.
- **Kaggle Cost of Living** — `https://www.kaggle.com/datasets/` — per-country cost indices informing `data/countries.json` `costPerDay` fields.
- **Seat61** — `https://www.seat61.com/` — train route and mandatory reservation data for `data/trains.json` and `data/reservations.json`.
- **Eurail / Interrail** — `https://www.eurail.com/` — DiscoverEU pass rules, seat credit mechanics, participating countries.
