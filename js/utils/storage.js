// js/utils/storage.js
// Namespaced LocalStorage wrapper with TTL cache.

const NS = 'discoveru:';

function safeGet(key) {
  try { return localStorage.getItem(NS + key); }
  catch (e) { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(NS + key, value); return true; }
  catch (e) { console.warn('[storage] write failed', e); return false; }
}

function safeRemove(key) {
  try { localStorage.removeItem(NS + key); } catch (e) { /* ignore */ }
}

/**
 * Persistent key/value store.
 *   storage.get('route'), storage.set('theme', 'dark')
 */
export const storage = {
  get(key, fallback = null) {
    const raw = safeGet(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  },

  set(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return safeSet(key, serialized);
  },

  remove(key) { safeRemove(key); },

  clear() {
    try {
      const prefix = NS;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }
};

/**
 * TTL cache on top of LocalStorage.
 *   cache.set('weather:42.1:28.3', data)
 *   cache.get('weather:42.1:28.3', 60 * 60 * 1000) // 1h max age
 */
export const cache = {
  set(key, value) {
    const entry = { t: Date.now(), v: value };
    return storage.set('cache:' + key, entry);
  },

  get(key, maxAgeMs = Infinity) {
    const entry = storage.get('cache:' + key);
    if (!entry || typeof entry !== 'object' || !('t' in entry)) return null;
    if (Date.now() - entry.t > maxAgeMs) {
      storage.remove('cache:' + key);
      return null;
    }
    return entry.v;
  },

  invalidate(key) {
    storage.remove('cache:' + key);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────────────────────────────────────────
// Minimal Promise-based wrapper around the browser IDB API. Used by Bingo
// for photo blob storage (store: `bingoPhotos`). One shared database
// (`discovereu`) so future stores can be added without new wiring.

const IDB_NAME = 'discovereu';
const IDB_VERSION = 5;
const IDB_STORES = ['bingoPhotos', 'journalEntries', 'voiceMemories', 'buddyCache', 'coachLessons', 'coachBadges'];

let _dbPromise = null;

export function idbOpen(dbName = IDB_NAME, version = IDB_VERSION) {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('[idb] IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of IDB_STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.__value !== undefined ? result.__value : result);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export async function idbPut(storeName, key, value) {
  return withStore(storeName, 'readwrite', store => { store.put(value, key); });
}

export async function idbGet(storeName, key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function idbDelete(storeName, key) {
  return withStore(storeName, 'readwrite', store => { store.delete(key); });
}

/** Return all { key, value } pairs in the store. */
export async function idbGetAll(storeName) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const out = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(out); return; }
      out.push({ key: cur.key, value: cur.value });
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Wipe all entries in a store. */
export async function idbClear(storeName) {
  return withStore(storeName, 'readwrite', store => { store.clear(); });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Intercultural Coach — typed helpers for coachLessons + coachBadges
// ─────────────────────────────────────────────────────────────────────────────

function coachLessonKey(countryId, lang) {
  return `${countryId}_${lang}`;
}

/** Persist a coach lesson. Key = `${countryId}_${lang}`. */
export async function putCoachLesson(lesson) {
  if (!lesson || !lesson.countryId || !lesson.lang) {
    throw new Error('[coach] putCoachLesson requires { countryId, lang }');
  }
  const key = lesson.id || coachLessonKey(lesson.countryId, lesson.lang);
  return idbPut('coachLessons', key, { ...lesson, id: key });
}

/** Fetch a coach lesson by country + language, or null. */
export async function getCoachLesson(countryId, lang) {
  return idbGet('coachLessons', coachLessonKey(countryId, lang));
}

/** Return all coach lessons as an array of values. */
export async function getAllCoachLessons() {
  const rows = await idbGetAll('coachLessons');
  return rows.map(r => r.value);
}

/** Persist a coach badge. Key = badgeId. */
export async function putCoachBadge(badge) {
  if (!badge || !badge.badgeId) {
    throw new Error('[coach] putCoachBadge requires { badgeId }');
  }
  return idbPut('coachBadges', badge.badgeId, badge);
}

/** Fetch a coach badge by badgeId, or null. */
export async function getCoachBadge(badgeId) {
  return idbGet('coachBadges', badgeId);
}

/** Return all coach badges as an array of values. */
export async function getAllCoachBadges() {
  const rows = await idbGetAll('coachBadges');
  return rows.map(r => r.value);
}
