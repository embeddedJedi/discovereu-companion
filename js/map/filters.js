// js/map/filters.js
// Pure functions that decide whether a country matches the current
// filter state. Kept free of Leaflet / DOM so other modules (search,
// templates, route-builder) can reuse the same matcher.

const CATEGORY_THRESHOLD = 4;        // score ≥ this to count as a category match
const ACCESSIBILITY_THRESHOLD = 4;
const LGBTQ_THRESHOLD = 4;

/**
 * Returns true if any filter the user can change is currently active.
 * `interrailOnly` is excluded on purpose — it's default-on and already
 * expressed visually via the `non-participating` class.
 */
export function filtersActive(filters) {
  if (!filters) return false;
  if (Array.isArray(filters.categories) && filters.categories.length > 0) return true;
  if (filters.budget && filters.budget !== 'all') return true;
  if (filters.accessibility) return true;
  if (filters.lgbtqSafe) return true;
  if (filters.green) return true;
  return false;
}

/**
 * Does a country row satisfy the current filter set?
 * Countries without scores fail any score-based filter.
 */
export function matchesFilters(country, filters) {
  if (!country) return false;
  if (!filters) return true;

  // Eligibility gate — never match non-DiscoverEU countries when the
  // interrailOnly toggle is on (which is the default).
  if (filters.interrailOnly && country.discoverEU === false) return false;

  const scores = country.scores || {};

  if (Array.isArray(filters.categories) && filters.categories.length > 0) {
    const allMatched = filters.categories.every(cat => (scores[cat] ?? 0) >= CATEGORY_THRESHOLD);
    if (!allMatched) return false;
  }

  if (filters.budget && filters.budget !== 'all') {
    const bf = scores.budgetFriendly ?? 0;
    if (filters.budget === 'low' && bf < 4) return false;
    if (filters.budget === 'mid' && (bf < 3 || bf > 4)) return false;
    if (filters.budget === 'high' && bf >= 3) return false;
  }

  if (filters.accessibility && (scores.accessibility ?? 0) < ACCESSIBILITY_THRESHOLD) return false;
  if (filters.lgbtqSafe && (scores.lgbtqFriendly ?? 0) < LGBTQ_THRESHOLD) return false;

  return true;
}

/**
 * Count how many countries in a list match the current filters.
 * Used by the filters panel to show a live result count.
 */
export function countMatches(countries, filters) {
  if (!Array.isArray(countries)) return 0;
  if (!filtersActive(filters)) {
    return countries.filter(c => c.discoverEU !== false).length;
  }
  return countries.reduce((n, c) => matchesFilters(c, filters) ? n + 1 : n, 0);
}
