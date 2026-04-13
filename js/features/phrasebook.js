// js/features/phrasebook.js
// v1.7 — Language Bridge: offline phrasebook loader + search + bookmark deck.
//
// Phrasebook JSON files live at /data/phrasebook/{countryId-lowercase}.json and
// are seeded for the five launch countries. Other countries will 404 until
// their JSON is added; callers should handle `Error('phrasebook-not-available')`.
//
// Bookmarks are persisted to state.languageBridge.savedPhrases (LocalStorage,
// capped at 500 via migrate) AND the IDB `phrasebookDeck` store so the full
// record survives when LocalStorage is evicted.

import { state } from '../state.js';
import {
  putPhrasebookBookmark,
  deletePhrasebookBookmark,
  getAllPhrasebookBookmarks
} from '../utils/storage.js';

// Countries with seeded phrasebooks under data/phrasebook/.
const AVAILABLE_COUNTRIES = ['DE', 'FR', 'IT', 'ES', 'TR'];

// Module-scoped memoization so a country's JSON is fetched at most once.
const _cache = new Map();      // countryId (upper) -> resolved phrasebook
const _inFlight = new Map();   // countryId (upper) -> Promise

/**
 * Load a country's phrasebook JSON from /data/phrasebook/{id}.json.
 * Memoized per country. Throws `Error('phrasebook-not-available')` on 404.
 *
 * @param {string} countryId ISO alpha-2 country code, case-insensitive.
 * @returns {Promise<{version:number,countryId:string,language:string,languageName:string,phrases:Array}>}
 */
export async function loadPhrasebook(countryId) {
  if (typeof countryId !== 'string' || !countryId) {
    throw new Error('[phrasebook] loadPhrasebook requires a countryId string');
  }
  const key = countryId.toUpperCase();
  if (_cache.has(key)) return _cache.get(key);
  if (_inFlight.has(key)) return _inFlight.get(key);

  const url = `data/phrasebook/${key.toLowerCase()}.json`;
  const p = (async () => {
    let res;
    try {
      res = await fetch(url, { cache: 'default' });
    } catch (err) {
      // Network failure (offline and not in SW cache).
      throw new Error('phrasebook-not-available');
    }
    if (res.status === 404) {
      throw new Error('phrasebook-not-available');
    }
    if (!res.ok) {
      throw new Error(`[phrasebook] fetch failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.phrases)) {
      throw new Error('[phrasebook] invalid phrasebook shape');
    }
    _cache.set(key, data);
    return data;
  })();

  _inFlight.set(key, p);
  try {
    const out = await p;
    return out;
  } finally {
    _inFlight.delete(key);
  }
}

/**
 * Case-insensitive substring search against phrase.source and phrase.target.
 * Pure function — does not mutate state.
 *
 * @param {object} phrasebook result from loadPhrasebook.
 * @param {string} query raw user input.
 * @param {{category?:string|null, limit?:number}} [opts]
 * @returns {Array} matching phrase objects (up to `limit`).
 */
export function searchPhrases(phrasebook, query, opts = {}) {
  if (!phrasebook || !Array.isArray(phrasebook.phrases)) return [];
  const { category = null, limit = 20 } = opts;
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';

  const out = [];
  for (const p of phrasebook.phrases) {
    if (category && p.category !== category) continue;
    if (q) {
      const src = typeof p.source === 'string' ? p.source.toLowerCase() : '';
      const tgt = typeof p.target === 'string' ? p.target.toLowerCase() : '';
      if (!src.includes(q) && !tgt.includes(q)) continue;
    }
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Distinct categories in order of first appearance in phrasebook.phrases.
 * @param {object} phrasebook
 * @returns {string[]}
 */
export function getCategories(phrasebook) {
  if (!phrasebook || !Array.isArray(phrasebook.phrases)) return [];
  const seen = new Set();
  const out = [];
  for (const p of phrasebook.phrases) {
    if (typeof p.category !== 'string' || !p.category) continue;
    if (seen.has(p.category)) continue;
    seen.add(p.category);
    out.push(p.category);
  }
  return out;
}

/**
 * Bookmark a phrase. Persists to IDB (full record) and appends a summary
 * entry to state.languageBridge.savedPhrases (LocalStorage, capped 500).
 *
 * No-op (returns existing entry) if the same {countryId}-{phraseId} is
 * already bookmarked.
 *
 * @param {object} phrase the phrase from phrasebook.phrases.
 * @param {string} countryId ISO alpha-2 country code.
 * @returns {Promise<object>} the stored bookmark entry.
 */
export async function bookmarkPhrase(phrase, countryId) {
  if (!phrase || typeof phrase.id !== 'string') {
    throw new Error('[phrasebook] bookmarkPhrase requires phrase.id');
  }
  if (typeof countryId !== 'string' || !countryId) {
    throw new Error('[phrasebook] bookmarkPhrase requires countryId');
  }
  const cc = countryId.toUpperCase();

  // Need the phrasebook to know target language code.
  const phrasebook = _cache.get(cc) || await loadPhrasebook(cc);

  const id = `${cc}-${phrase.id}`;
  const lb = state.getSlice('languageBridge') || { savedPhrases: [] };
  const existing = (lb.savedPhrases || []).find(p => p.id === id);
  if (existing) return existing;

  const entry = {
    id,
    countryId: cc,
    source: phrase.source,
    target: phrase.target,
    sourceLang: 'en',
    targetLang: phrasebook.language,
    savedAt: new Date().toISOString()
  };

  // Persist full entry to IDB (same shape — the summary IS the full record
  // for phrasebook bookmarks).
  await putPhrasebookBookmark(entry);

  // Append to state (migrate caps at 500 FIFO).
  state.update('languageBridge', current => ({
    ...current,
    savedPhrases: [...(current?.savedPhrases || []), entry]
  }));

  return entry;
}

/**
 * Remove a bookmark by compound id from both state and IDB.
 * @param {string} id compound `${countryId}-${phraseId}`.
 * @returns {Promise<void>}
 */
export async function removeBookmark(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('[phrasebook] removeBookmark requires an id string');
  }
  await deletePhrasebookBookmark(id);
  state.update('languageBridge', current => ({
    ...current,
    savedPhrases: (current?.savedPhrases || []).filter(p => p.id !== id)
  }));
}

/**
 * Return saved phrases from state (authoritative for UI rendering).
 * @returns {Array}
 */
export function getSavedPhrases() {
  const lb = state.getSlice('languageBridge');
  return lb && Array.isArray(lb.savedPhrases) ? lb.savedPhrases : [];
}

/**
 * ISO alpha-2 codes for countries with seeded phrasebook JSON.
 * @returns {string[]}
 */
export function getAvailableCountries() {
  return [...AVAILABLE_COUNTRIES];
}

/**
 * Rehydrate state.languageBridge.savedPhrases from IDB on boot. Useful if
 * LocalStorage was cleared but IDB survived. Safe to call at any time —
 * merges by id (IDB wins on conflict).
 * @returns {Promise<void>}
 */
export async function hydrateBookmarksFromIDB() {
  let rows;
  try {
    rows = await getAllPhrasebookBookmarks();
  } catch (e) {
    console.warn('[phrasebook] hydrate from IDB failed', e);
    return;
  }
  if (!rows.length) return;
  state.update('languageBridge', current => {
    const existing = new Map((current?.savedPhrases || []).map(p => [p.id, p]));
    for (const row of rows) {
      if (row && typeof row.id === 'string') existing.set(row.id, row);
    }
    return { ...current, savedPhrases: [...existing.values()] };
  });
}
