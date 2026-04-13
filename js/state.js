// js/state.js
// Central reactive state store. Single source of truth.
// Subscribers are notified when the slice they subscribe to changes.

import { storage } from './utils/storage.js';

const PERSIST_KEYS = ['theme', 'language', 'user', 'route', 'filters', 'prep', 'bingo', 'dares', 'futureMessages', 'impact', 'a11y', 'buddy', 'coach'];

const BUDDY_VALID_KINDS = ['local', 'mentor', 'traveler'];
const BUDDY_SEEN_CAP = 200;
const BUDDY_DEFAULTS = {
  handle: null,
  consented: false,
  preferences: {
    kinds: [],
    citiesOptIn: []
  },
  seenIds: []
};

const A11Y_DEFAULTS = {
  dyslexiaMode: false,
  lowBandwidth: false,
  reduceMotion: null,           // null = follow OS, true = force on, false = force off
  highContrast: false,
  fontScale: 1.0,               // allowed: 0.85 | 1.25 | 1.5 (1.0 default baseline)
  lineHeight: 1.5,              // allowed: 1.5 | 1.8 | 2.0
  letterSpacing: 0,             // allowed: 0 | 0.05 | 0.1 (em)
  colorBlindMode: 'none',       // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  transcribeVoice: false,
  wheelchairLayer: false        // v1.5 — map overlay for step-free metro stations
};
const A11Y_FONT_SCALES = [0.85, 1.0, 1.25, 1.5];
const A11Y_LINE_HEIGHTS = [1.5, 1.8, 2.0];
const A11Y_LETTER_SPACINGS = [0, 0.05, 0.1];
const A11Y_COLOR_BLIND = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];

// v1.6 — Intercultural Coach
const COACH_BADGES_CAP = 50;
const COACH_DEFAULTS = {
  lessonsCompleted: {},   // { [countryId]: { completedAt: ISO, passed: bool, attempts: int } }
  quizScores: {},         // { [countryId]: 0-5 }
  badgesEarned: []        // [{ countryId, badgeId, issuedAt, jsonLdHash }]
};

function isIsoString(v) {
  if (typeof v !== 'string' || !v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function snapNearest(value, allowed) {
  let best = allowed[0];
  let bestDiff = Math.abs(value - best);
  for (let i = 1; i < allowed.length; i++) {
    const d = Math.abs(value - allowed[i]);
    if (d < bestDiff) { best = allowed[i]; bestDiff = d; }
  }
  return best;
}

const initialState = {
  theme: 'light',
  language: 'en',
  user: {
    groupSize: 4,
    homeCountry: 'TR',
    homeCity: 'ist',
    budget: 'moderate',        // 'budget' | 'moderate' | 'comfort'
    accommodation: 'hostel',   // 'hostel' | 'airbnb' | 'camp' | 'couchsurf'
    foodStyle: 'moderate',     // 'budget' | 'moderate' | 'comfort'
    onboarded: false,          // Welcome wizard completion flag — persisted via PERSIST_KEYS.user
    consulateAppointment: null // { countryId, city, datetime, notes } | null — sub-project 2
  },
  route: {
    stops: [],                 // [{ countryId, cityId, nights, arrivalDay, transport }]
    returnStops: [],           // [{ countryId, cityId, nights, arrivalDay, transport }] — return leg
    includeReturnInBudget: true, // when true, return leg counts against budget + seat credits
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
    green: false,
    hideLateArrival: false,  // Night Arrival Shield — hide templates/routes with 22:00+ arrivals
    greenHostelsOnly: false  // v1.7 — restrict accommodation suggestions to certified green hostels
  },
  selectedCountry: null,
  panelTab: 'detail',
  panelOpen: false,
  compare: [],                 // list of country ids (max 4) — ephemeral
  inclusionMode: 'default',    // 'default' | 'rainbow' | 'accessibility' — ephemeral
  currentPage: 'map',          // 'map' | 'plan' | 'fun' | 'guide' | 'more' — ephemeral
  activeFunSubtab: 'bingo',    // 'bingo' | 'dares' | 'futureMe' — ephemeral
  bingo: {                     // persisted
    completed: {}              // { [challengeId]: true }
  },
  dares: {                     // persisted
    completed: {},             // { [YYYY-MM-DD]: true | 'skipped' }
    lastDareId: null,
    streak: 0
  },
  futureMessages: [],          // persisted — [{ id, message, createdAt, revealDate }]
  ai: {                        // ephemeral
    groqKey: null,             // mirrors localStorage['discoveru:ai.groqKey']
    lastSuggestion: null       // ephemeral, retained for retry UX
  },
  prep: {
    departureDate: null,       // ISO "YYYY-MM-DD" or null
    checklistDone: {},         // { itemId: true }
    packingDone:   {},         // { itemId: true }
    packingCustom: []          // [{ id, label, category }] — user-added items
  },
  impact: {                    // persisted — v1.4 Impact Dashboard
    aggregateOptIn: false,     // user consent to contribute anonymous aggregate metrics
    badgesEarned: [],          // [badgeId, ...] milestone badges unlocked
    lastSnapshotHash: null     // hash of last computed impact snapshot for change detection
  },
  a11y: { ...A11Y_DEFAULTS },  // persisted — v1.5 Accessibility Overlay
  buddy: {                     // persisted — v1.6 Buddy Matching
    ...BUDDY_DEFAULTS,
    preferences: { ...BUDDY_DEFAULTS.preferences, kinds: [], citiesOptIn: [] },
    seenIds: []
  },
  coach: {                     // persisted — v1.6 Intercultural Coach
    lessonsCompleted: {},
    quizScores: {},
    badgesEarned: []
  },
  countries: [],               // loaded from data/countries.json
  trains: [],                  // loaded from data/trains.json
  reservations: [],            // loaded from data/reservations.json
  routeTemplates: []           // loaded from data/route-templates.json
};

/**
 * Migrate persisted state shape to current version.
 * Adds fields introduced after a user's last visit so old LocalStorage
 * payloads don't break new features (e.g. v1.2 round-trip routing).
 */
function migrate(persisted) {
  if (persisted?.user && !persisted.user.homeCity) {
    persisted.user.homeCity = 'ist';
  }
  if (persisted?.route) {
    if (!Array.isArray(persisted.route.returnStops)) persisted.route.returnStops = [];
    if (typeof persisted.route.includeReturnInBudget !== 'boolean') persisted.route.includeReturnInBudget = true;
  }
  // v1.7 — sanitize greenHostelsOnly filter (must be boolean; missing is fine — _hydrate merges defaults).
  if (persisted?.filters && typeof persisted.filters === 'object') {
    if ('greenHostelsOnly' in persisted.filters && typeof persisted.filters.greenHostelsOnly !== 'boolean') {
      persisted.filters.greenHostelsOnly = false;
    }
  }
  // v1.4 — backfill impact slice for users who persisted state before this release.
  if (!persisted.impact || typeof persisted.impact !== 'object') {
    persisted.impact = { aggregateOptIn: false, badgesEarned: [], lastSnapshotHash: null };
  } else {
    if (typeof persisted.impact.aggregateOptIn !== 'boolean') persisted.impact.aggregateOptIn = false;
    if (!Array.isArray(persisted.impact.badgesEarned)) persisted.impact.badgesEarned = [];
    if (persisted.impact.lastSnapshotHash === undefined) persisted.impact.lastSnapshotHash = null;
  }
  // v1.5 — backfill + sanitize a11y slice (Accessibility Overlay).
  if (!persisted.a11y || typeof persisted.a11y !== 'object') {
    persisted.a11y = { ...A11Y_DEFAULTS };
  } else {
    const a = persisted.a11y;
    if (typeof a.dyslexiaMode !== 'boolean') a.dyslexiaMode = A11Y_DEFAULTS.dyslexiaMode;
    if (typeof a.lowBandwidth !== 'boolean') a.lowBandwidth = A11Y_DEFAULTS.lowBandwidth;
    if (typeof a.highContrast !== 'boolean') a.highContrast = A11Y_DEFAULTS.highContrast;
    if (typeof a.transcribeVoice !== 'boolean') a.transcribeVoice = A11Y_DEFAULTS.transcribeVoice;
    if (typeof a.wheelchairLayer !== 'boolean') a.wheelchairLayer = A11Y_DEFAULTS.wheelchairLayer;
    // reduceMotion must be strictly null | true | false
    if (!(a.reduceMotion === null || a.reduceMotion === true || a.reduceMotion === false)) {
      a.reduceMotion = null;
    }
    // fontScale — snap to nearest valid value if out of whitelist
    if (typeof a.fontScale !== 'number' || !A11Y_FONT_SCALES.includes(a.fontScale)) {
      a.fontScale = typeof a.fontScale === 'number'
        ? snapNearest(a.fontScale, A11Y_FONT_SCALES)
        : A11Y_DEFAULTS.fontScale;
    }
    // lineHeight — fall back to 1.5 when outside whitelist
    if (typeof a.lineHeight !== 'number' || !A11Y_LINE_HEIGHTS.includes(a.lineHeight)) {
      a.lineHeight = 1.5;
    }
    // letterSpacing — snap to nearest valid (0 | 0.05 | 0.1)
    if (typeof a.letterSpacing !== 'number' || !A11Y_LETTER_SPACINGS.includes(a.letterSpacing)) {
      a.letterSpacing = typeof a.letterSpacing === 'number'
        ? snapNearest(a.letterSpacing, A11Y_LETTER_SPACINGS)
        : A11Y_DEFAULTS.letterSpacing;
    }
    // colorBlindMode — force to 'none' when not in whitelist
    if (!A11Y_COLOR_BLIND.includes(a.colorBlindMode)) {
      a.colorBlindMode = 'none';
    }
  }
  // v1.6 — backfill + sanitize buddy slice (Buddy Matching).
  if (!persisted.buddy || typeof persisted.buddy !== 'object') {
    persisted.buddy = {
      handle: null,
      consented: false,
      preferences: { kinds: [], citiesOptIn: [] },
      seenIds: []
    };
  } else {
    const b = persisted.buddy;
    if (typeof b.handle !== 'string') b.handle = null;
    if (typeof b.consented !== 'boolean') b.consented = false;
    if (!b.preferences || typeof b.preferences !== 'object') {
      b.preferences = { kinds: [], citiesOptIn: [] };
    } else {
      if (!Array.isArray(b.preferences.kinds)) {
        b.preferences.kinds = [];
      } else {
        b.preferences.kinds = b.preferences.kinds.filter(k => BUDDY_VALID_KINDS.includes(k));
      }
      if (!Array.isArray(b.preferences.citiesOptIn)) b.preferences.citiesOptIn = [];
    }
    if (!Array.isArray(b.seenIds)) b.seenIds = [];
    // FIFO-drop oldest entries when seenIds exceeds cap.
    if (b.seenIds.length > BUDDY_SEEN_CAP) {
      b.seenIds = b.seenIds.slice(b.seenIds.length - BUDDY_SEEN_CAP);
    }
  }
  // v1.6 — backfill + sanitize coach slice (Intercultural Coach).
  if (!isPlainObject(persisted.coach)) {
    persisted.coach = {
      lessonsCompleted: {},
      quizScores: {},
      badgesEarned: []
    };
  } else {
    const c = persisted.coach;
    // lessonsCompleted — object of { completedAt, passed, attempts }
    if (!isPlainObject(c.lessonsCompleted)) {
      c.lessonsCompleted = {};
    } else {
      const cleaned = {};
      for (const [countryId, entry] of Object.entries(c.lessonsCompleted)) {
        if (!isPlainObject(entry)) continue;
        if (!isIsoString(entry.completedAt)) continue;
        if (typeof entry.passed !== 'boolean') continue;
        if (!Number.isInteger(entry.attempts) || entry.attempts < 0) continue;
        cleaned[countryId] = {
          completedAt: entry.completedAt,
          passed: entry.passed,
          attempts: entry.attempts
        };
      }
      c.lessonsCompleted = cleaned;
    }
    // quizScores — object of integer 0..5
    if (!isPlainObject(c.quizScores)) {
      c.quizScores = {};
    } else {
      const cleaned = {};
      for (const [countryId, score] of Object.entries(c.quizScores)) {
        if (Number.isInteger(score) && score >= 0 && score <= 5) {
          cleaned[countryId] = score;
        }
      }
      c.quizScores = cleaned;
    }
    // badgesEarned — array of { countryId, badgeId, issuedAt, jsonLdHash }
    if (!Array.isArray(c.badgesEarned)) {
      c.badgesEarned = [];
    } else {
      c.badgesEarned = c.badgesEarned.filter(b =>
        isPlainObject(b) &&
        typeof b.countryId === 'string' &&
        typeof b.badgeId === 'string' &&
        isIsoString(b.issuedAt) &&
        typeof b.jsonLdHash === 'string'
      ).map(b => ({
        countryId: b.countryId,
        badgeId: b.badgeId,
        issuedAt: b.issuedAt,
        jsonLdHash: b.jsonLdHash
      }));
      if (c.badgesEarned.length > COACH_BADGES_CAP) {
        c.badgesEarned = c.badgesEarned.slice(c.badgesEarned.length - COACH_BADGES_CAP);
      }
    }
  }
  return persisted;
}

class Store {
  constructor(initial) {
    this._state = this._hydrate(initial);
    this._listeners = new Map();  // key -> Set<callback>
  }

  _hydrate(initial) {
    // Collect persisted slices, run shape migration, then merge with initial defaults.
    const persisted = {};
    for (const key of PERSIST_KEYS) {
      const stored = storage.get(key);
      if (stored != null) persisted[key] = stored;
    }
    migrate(persisted);

    const hydrated = { ...initial };
    for (const key of PERSIST_KEYS) {
      if (persisted[key] == null) continue;
      hydrated[key] = typeof initial[key] === 'object' && !Array.isArray(initial[key])
        ? { ...initial[key], ...persisted[key] }
        : persisted[key];
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
