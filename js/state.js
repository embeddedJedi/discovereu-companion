// js/state.js
// Central reactive state store. Single source of truth.
// Subscribers are notified when the slice they subscribe to changes.

import { storage } from './utils/storage.js';

const PERSIST_KEYS = ['theme', 'language', 'user', 'route', 'filters', 'prep'];

const initialState = {
  theme: 'light',
  language: 'en',
  user: {
    groupSize: 4,
    homeCountry: 'TR',
    budget: 'moderate',        // 'budget' | 'moderate' | 'comfort'
    accommodation: 'hostel',   // 'hostel' | 'airbnb' | 'camp' | 'couchsurf'
    foodStyle: 'moderate'      // 'budget' | 'moderate' | 'comfort'
  },
  route: {
    stops: [],                 // [{ countryId, cityId, nights, arrivalDay, transport }]
    travelDaysLimit: 7,
    seatCreditsLimit: 4,
    name: ''
  },
  filters: {
    categories: [],            // ['nature', 'culture', 'nightlife', 'food', 'beach', 'history']
    budget: 'all',             // 'all' | 'low' | 'mid' | 'high'
    interrailOnly: true,
    accessibility: false,
    lgbtqSafe: false,
    green: false
  },
  selectedCountry: null,
  panelTab: 'detail',
  panelOpen: false,
  compare: [],                 // list of country ids (max 4) — ephemeral
  prep: {
    departureDate: null,       // ISO "YYYY-MM-DD" or null
    checklistDone: {},         // { itemId: true }
    packingDone:   {}          // { itemId: true }
  },
  countries: [],               // loaded from data/countries.json
  trains: [],                  // loaded from data/trains.json
  reservations: [],            // loaded from data/reservations.json
  routeTemplates: []           // loaded from data/route-templates.json
};

class Store {
  constructor(initial) {
    this._state = this._hydrate(initial);
    this._listeners = new Map();  // key -> Set<callback>
  }

  _hydrate(initial) {
    const hydrated = { ...initial };
    for (const key of PERSIST_KEYS) {
      const stored = storage.get(key);
      if (stored != null) {
        hydrated[key] = typeof initial[key] === 'object' && !Array.isArray(initial[key])
          ? { ...initial[key], ...stored }
          : stored;
      }
    }
    return hydrated;
  }

  _persist(key) {
    if (PERSIST_KEYS.includes(key)) {
      storage.set(key, this._state[key]);
    }
  }

  /** Return a snapshot of the full state (shallow copy). */
  get() {
    return { ...this._state };
  }

  /** Return a single slice. */
  getSlice(key) {
    return this._state[key];
  }

  /**
   * Set a slice to a new value, notifying subscribers.
   *   state.set('theme', 'dark')
   */
  set(key, value) {
    if (this._state[key] === value) return;
    this._state[key] = value;
    this._persist(key);
    this._notify(key, value);
  }

  /**
   * Functionally update a slice.
   *   state.update('route', r => ({ ...r, stops: [...r.stops, newStop] }))
   */
  update(key, updater) {
    const next = updater(this._state[key]);
    if (next !== this._state[key]) {
      this._state[key] = next;
      this._persist(key);
      this._notify(key, next);
    }
  }

  /**
   * Subscribe to changes on a specific slice.
   * Returns an unsubscribe function.
   */
  subscribe(key, callback) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(callback);
    return () => this._listeners.get(key).delete(callback);
  }

  /** Subscribe to every change. */
  subscribeAll(callback) {
    if (!this._listeners.has('*')) this._listeners.set('*', new Set());
    this._listeners.get('*').add(callback);
    return () => this._listeners.get('*').delete(callback);
  }

  _notify(key, value) {
    const subs = this._listeners.get(key);
    if (subs) subs.forEach(cb => { try { cb(value, key); } catch (e) { console.error('[state]', e); } });
    const wild = this._listeners.get('*');
    if (wild) wild.forEach(cb => { try { cb(value, key); } catch (e) { console.error('[state]', e); } });
  }

  /** Reset everything to initial (for debug / tests). */
  reset() {
    storage.clear();
    this._state = { ...initialState };
    for (const key of Object.keys(this._state)) this._notify(key, this._state[key]);
  }
}

export const state = new Store(initialState);

// Handy helpers for common derivations
export function selectedCountry() {
  const id = state.getSlice('selectedCountry');
  if (!id) return null;
  return state.getSlice('countries').find(c => c.id === id) || null;
}

export function countryById(id) {
  return state.getSlice('countries').find(c => c.id === id) || null;
}
