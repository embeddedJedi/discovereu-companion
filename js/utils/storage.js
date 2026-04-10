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
