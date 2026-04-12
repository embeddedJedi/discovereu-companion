# Data & Polish (Sub-project E) Implementation Plan

**Goal:** Ship 3 final v1.1 items: shared mobility data in guides, live Wikivoyage refresh, pickpocket heatmap.

---

### Feature E1: Shared Mobility Guide Data

**Files:**
- Create: `data/shared-mobility.json` (separate file to keep `guides.json` smaller)
- Modify: `js/ui/guide.js` (add "Shared Mobility" accordion section between Transport and Budget)
- Modify: `i18n/en.json`, `i18n/tr.json` (`sharedMobility.*` keys)

**Data shape:**
```json
{
  "countries": {
    "FR": {
      "ridesharing": { "available": true, "platforms": ["BlaBlaCar"], "notes": "…" },
      "carpooling": { "platforms": [] }
    }
  },
  "cities": {
    "paris": {
      "scooters": ["Lime","Bolt"], "bikes": ["Vélib'"], "carSharing": ["ShareNow"], "rideHailing": ["Uber","Bolt"], "priceRange": "…", "tips": "…"
    }
  }
}
```

Populate at least 20 countries (all EU27 major + TR/CH/NO/UK-adjacent) and ~30 top-tier cities from existing `cities.json`. Research from Wikivoyage, official city transit sites, widely-known platform availability.

**Commit:** `feat(v1.1): shared mobility data — 20 countries + 30 cities ride/scooter/bike data`

---

### Feature E2: Live Wikivoyage Refresh

**Files:**
- Create: `js/features/wikivoyage-refresh.js`
- Modify: `js/ui/guide.js` (add "Refresh" buttons per guide section)
- Modify: `i18n/en.json`, `i18n/tr.json` (`wikivoyage.*` keys)

**API:**
- `refreshCountry(countryId)` → fetches Wikivoyage article via MediaWiki API `https://en.wikivoyage.org/w/api.php?action=parse&page=X&format=json&prop=sections|text&origin=*` (CORS-friendly with `origin=*`), parses selected sections, returns updated content
- `refreshCity(cityName)` → same for city
- Cache result in localStorage `wikivoyage-${type}-${id}` with 24h TTL

**UI:** Small "↻ Refresh from Wikivoyage" button in each guide section header. Spinner during fetch. Toast on success/fail. Parsed HTML replaces the static `guides.json` snapshot for that entry.

**Commit:** `feat(v1.1): live Wikivoyage refresh — on-demand guide section updates`

---

### Feature E3: Pickpocket Heatmap

**Files:**
- Create: `data/pickpocket-zones.json` (~30 major tourist cities)
- Create: `js/features/pickpocket.js` (Leaflet overlay + guide section)
- Modify: `js/pages/map.js` (add to layer toggle controls)
- Modify: `js/ui/guide.js` (add "Safety" callout in city detail)
- Modify: `i18n/en.json`, `i18n/tr.json` (`pickpocket.*` keys)

**Data shape:**
```json
{
  "cities": {
    "barcelona": {
      "riskScore": 5,
      "hotspots": ["La Rambla", "Plaça de Catalunya", "Metro L3 near Passeig de Gràcia"],
      "tips": ["Keep wallet in front pocket", "Beware of petition scams on La Rambla"],
      "source": "Numbeo + Wikivoyage + forum consensus 2025"
    }
  }
}
```

Populate with ~30 major tourist cities (Barcelona, Rome, Paris, Prague, Amsterdam, etc.). Risk score 1-5. Sources: Numbeo crime index, Wikivoyage "Stay safe" sections.

**Map layer:** `js/features/pickpocket.js` exports `toggleLayer(map, on)` that adds circle markers colored by risk (green=1-2, yellow=3, red=4-5) at each city's coordinates. Toggle in map page layer controls.

**Guide section:** In country/city guide accordion, add a "Safety" callout showing risk level, hotspots, tips.

**Commit:** `feat(v1.1): pickpocket heatmap — 30 city risk data + map layer + guide safety callouts`

---

### Feature E4: PROGRESS.md + push

Mark Pickpocket heatmap, shared mobility, Wikivoyage refresh all done. Push.
