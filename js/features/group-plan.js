// js/features/group-plan.js
// v1.7 — Multi-origin Group Planner orchestrator.
// Wraps create / add / remove / transferLeadership / computeOptimalMeetingPoint
// plus URL-shareable state via LZ-string short-key schema.
//
// All mutations go through state.update(). LZString is read from window.LZString
// (CDN-loaded in index.html). DOM-free; UI lives in js/ui/group-plan-panel.js.

import { state } from '../state.js';
import { loadJson } from '../data/loader.js';
import { computeMeetingPoint } from './meeting-point.js';

// Mirrors GROUP_MAX_MEMBERS in state.js (must stay in sync).
const GROUP_MAX_MEMBERS = 10;

// URL length budget (compressed, after LZString.compressToEncodedURIComponent).
const URL_WARN_LENGTH = 1500;
const URL_FAIL_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLZ() {
  const lz = (typeof window !== 'undefined') ? window.LZString : null;
  if (!lz) throw new Error('LZString global not available — check CDN script in index.html');
  return lz;
}

/** 8-character base36 group code, e.g. "ABCD1234". */
export function generateGroupCode() {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += Math.floor(Math.random() * 36).toString(36).toUpperCase();
  }
  return out;
}

function genMemberId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback (non-crypto) for older runtimes — still unique enough for in-session use.
  return 'm-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

function normalizeMember(member) {
  if (!member || typeof member !== 'object') {
    throw new Error('member must be an object');
  }
  const prefs = (member.preferences && typeof member.preferences === 'object') ? member.preferences : {};
  return {
    id: typeof member.id === 'string' && member.id ? member.id : genMemberId(),
    displayName: String(member.displayName || ''),
    homeCountry: String(member.homeCountry || ''),
    homeCity: String(member.homeCity || ''),
    preferences: {
      kindLikes: Array.isArray(prefs.kindLikes) ? prefs.kindLikes.slice() : [],
      avoidCategories: Array.isArray(prefs.avoidCategories) ? prefs.avoidCategories.slice() : []
    }
  };
}

function emit(name, detail) {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_e) { /* no-op */ }
}

// ---------------------------------------------------------------------------
// Group lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialise a new group with `leaderMember` as the first member + leader.
 * Overwrites any existing state.group payload. Returns the new group state.
 */
export function createGroup(leaderMember) {
  const leader = normalizeMember(leaderMember);
  const next = {
    members: [leader],
    leaderId: leader.id,
    createdAt: new Date().toISOString(),
    groupCode: generateGroupCode()
  };
  state.update('group', () => next);
  return state.getSlice('group');
}

/**
 * Append a member. Throws 'group-full' when at the 10-member cap.
 * If a member with the same id already exists, the existing entry is replaced.
 */
export function addMember(member) {
  const incoming = normalizeMember(member);
  const current = state.getSlice('group');
  const members = Array.isArray(current?.members) ? current.members.slice() : [];
  const existingIdx = members.findIndex(m => m.id === incoming.id);

  if (existingIdx === -1 && members.length >= GROUP_MAX_MEMBERS) {
    throw new Error('group-full');
  }

  if (existingIdx >= 0) {
    members[existingIdx] = incoming;
  } else {
    members.push(incoming);
  }

  state.update('group', g => ({ ...g, members }));
  return incoming;
}

/**
 * Remove a member. The leader cannot remove themselves without first
 * transferring leadership — throws 'leader-cannot-leave' in that case.
 */
export function removeMember(memberId) {
  const current = state.getSlice('group');
  const members = Array.isArray(current?.members) ? current.members : [];
  if (memberId === current?.leaderId) {
    throw new Error('leader-cannot-leave');
  }
  const next = members.filter(m => m.id !== memberId);
  state.update('group', g => ({ ...g, members: next }));
  return next;
}

/**
 * Promote `newLeaderId` to leader. Target must already be a member.
 */
export function transferLeadership(newLeaderId) {
  const current = state.getSlice('group');
  const members = Array.isArray(current?.members) ? current.members : [];
  if (!members.some(m => m.id === newLeaderId)) {
    throw new Error('not-a-member');
  }
  state.update('group', g => ({ ...g, leaderId: newLeaderId }));
  return newLeaderId;
}

// ---------------------------------------------------------------------------
// City coordinate resolution
// ---------------------------------------------------------------------------

let _coordsIndexPromise = null;

/**
 * Build `{ [countryId]: { [cityId]: {lat,lng} } }`. Primary source is
 * countries.json (cities array if present); falls back to buddy-cities.json
 * for countries that don't yet ship inline city coords.
 */
async function loadCityCoordsIndex() {
  if (_coordsIndexPromise) return _coordsIndexPromise;
  _coordsIndexPromise = (async () => {
    const idx = {};

    const countriesDoc = await loadJson('countries.json');
    const countries = Array.isArray(countriesDoc) ? countriesDoc : (countriesDoc?.countries || []);
    for (const c of countries) {
      if (!Array.isArray(c.cities)) continue;
      const bucket = idx[c.id] || (idx[c.id] = {});
      for (const city of c.cities) {
        const lat = Number(city.lat);
        const lng = Number(city.lng ?? city.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          bucket[city.id] = { lat, lng };
        }
      }
    }

    // Fallback: buddy-cities.json carries lat/lng for the major DiscoverEU cities.
    try {
      const buddy = await loadJson('buddy-cities.json');
      const list = Array.isArray(buddy) ? buddy : (buddy?.cities || []);
      for (const city of list) {
        const lat = Number(city.lat);
        const lng = Number(city.lng ?? city.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const bucket = idx[city.countryId] || (idx[city.countryId] = {});
        if (!bucket[city.cityId]) bucket[city.cityId] = { lat, lng };
      }
    } catch (e) {
      console.warn('[group-plan] buddy-cities.json unavailable for city coord fallback', e?.message || e);
    }

    return idx;
  })();
  return _coordsIndexPromise;
}

function resolveMemberCoords(member, idx) {
  const bucket = idx[member.homeCountry];
  if (!bucket) return null;
  return bucket[member.homeCity] || null;
}

/**
 * Resolve every member's homeCity to {lat,lng} and call computeMeetingPoint.
 * Supports AbortController for cancel.
 *   await computeOptimalMeetingPoint({ eligibleCountryIds, signal })
 */
export async function computeOptimalMeetingPoint({ eligibleCountryIds, signal } = {}) {
  const group = state.getSlice('group');
  const members = Array.isArray(group?.members) ? group.members : [];
  if (members.length === 0) throw new Error('no-members');

  if (signal?.aborted) throw new Error('aborted');

  const idx = await loadCityCoordsIndex();
  if (signal?.aborted) throw new Error('aborted');

  const memberHomes = [];
  const unresolved = [];
  for (const m of members) {
    const c = resolveMemberCoords(m, idx);
    if (c) memberHomes.push({ id: m.id, lat: c.lat, lng: c.lng });
    else unresolved.push({ id: m.id, displayName: m.displayName, homeCountry: m.homeCountry, homeCity: m.homeCity });
  }
  if (memberHomes.length === 0) {
    const err = new Error('no-resolvable-homes');
    err.unresolved = unresolved;
    throw err;
  }

  const opts = { eligibleCountryIds, signal };
  return computeMeetingPoint(memberHomes, opts);
}

// ---------------------------------------------------------------------------
// URL share — short-key schema + LZ-string
// ---------------------------------------------------------------------------

function shortShape(group) {
  const members = Array.isArray(group?.members) ? group.members : [];
  return {
    m: members.map(m => [
      String(m.id || '').slice(0, 8),
      String(m.displayName || ''),
      String(m.homeCountry || ''),
      String(m.homeCity || ''),
      Array.isArray(m.preferences?.kindLikes) ? m.preferences.kindLikes.slice(0, 3) : [],
      Array.isArray(m.preferences?.avoidCategories) ? m.preferences.avoidCategories.slice(0, 3) : []
    ]),
    l: String(group?.leaderId || '').slice(0, 8),
    c: String(group?.groupCode || ''),
    t: group?.createdAt ? Date.parse(group.createdAt) : Date.now()
  };
}

function expandShape(short) {
  if (!short || typeof short !== 'object') throw new Error('invalid-group-url');
  if (!Array.isArray(short.m)) throw new Error('invalid-group-url');

  const members = short.m.map(row => {
    if (!Array.isArray(row) || row.length < 4) throw new Error('invalid-group-url');
    const [id, displayName, homeCountry, homeCity, kindLikes, avoidCategories] = row;
    if (typeof id !== 'string' || !id) throw new Error('invalid-group-url');
    return {
      id,
      displayName: typeof displayName === 'string' ? displayName : '',
      homeCountry: typeof homeCountry === 'string' ? homeCountry : '',
      homeCity: typeof homeCity === 'string' ? homeCity : '',
      preferences: {
        kindLikes: Array.isArray(kindLikes) ? kindLikes.filter(x => typeof x === 'string') : [],
        avoidCategories: Array.isArray(avoidCategories) ? avoidCategories.filter(x => typeof x === 'string') : []
      }
    };
  });

  if (typeof short.l !== 'string') throw new Error('invalid-group-url');
  if (typeof short.c !== 'string') throw new Error('invalid-group-url');

  // The compressed `l` is the leaderId truncated to 8 chars; match it back to a member.
  const leader = members.find(m => m.id.slice(0, 8) === short.l) || members[0];

  const tNum = Number(short.t);
  const createdAt = Number.isFinite(tNum) ? new Date(tNum).toISOString() : new Date().toISOString();

  return {
    members,
    leaderId: leader ? leader.id : null,
    createdAt,
    groupCode: short.c
  };
}

/**
 * Compress state.group into a fragment suitable for `#/group?g=<...>`.
 * Throws 'group-url-too-long' if the result exceeds the hard cap.
 * Emits a `group:url-long` window event when above the warn threshold.
 */
export function encodeGroupUrl() {
  const lz = getLZ();
  const group = state.getSlice('group');
  const short = shortShape(group);
  const json = JSON.stringify(short);
  const compressed = lz.compressToEncodedURIComponent(json);

  console.log('[group-plan] encodeGroupUrl length:', compressed.length);

  if (compressed.length > URL_FAIL_LENGTH) {
    throw new Error('group-url-too-long');
  }
  if (compressed.length > URL_WARN_LENGTH) {
    emit('group:url-long', { length: compressed.length, threshold: URL_WARN_LENGTH });
  }
  return compressed;
}

/**
 * Inverse of encodeGroupUrl. Returns the full group state shape; throws
 * 'invalid-group-url' on malformed input.
 */
export function decodeGroupUrl(compressedStr) {
  if (typeof compressedStr !== 'string' || !compressedStr) {
    throw new Error('invalid-group-url');
  }
  const lz = getLZ();
  let json;
  try {
    json = lz.decompressFromEncodedURIComponent(compressedStr);
  } catch (_e) {
    throw new Error('invalid-group-url');
  }
  if (!json) throw new Error('invalid-group-url');
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (_e) {
    throw new Error('invalid-group-url');
  }
  return expandShape(parsed);
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Reconcile an incoming shared group state against the current local group.
 *   - No local group     → adopt incoming.
 *   - Same groupCode     → union members by id (incoming wins on conflict).
 *   - Different groupCode → return { action: 'conflict' } so the caller can
 *                          surface a switch-group prompt.
 */
export function mergeIncomingGroup(incomingState, currentUserId) {
  if (!incomingState || typeof incomingState !== 'object') {
    throw new Error('invalid-incoming-group');
  }
  const local = state.getSlice('group');
  const localEmpty = !local || !local.groupCode || !Array.isArray(local.members) || local.members.length === 0;

  if (localEmpty) {
    state.update('group', () => ({
      members: Array.isArray(incomingState.members) ? incomingState.members.slice() : [],
      leaderId: incomingState.leaderId || null,
      createdAt: incomingState.createdAt || new Date().toISOString(),
      groupCode: incomingState.groupCode || null
    }));
    return { action: 'adopted', userId: currentUserId };
  }

  if (local.groupCode === incomingState.groupCode) {
    const byId = new Map();
    for (const m of (local.members || [])) byId.set(m.id, m);
    for (const m of (incomingState.members || [])) byId.set(m.id, m); // incoming overrides
    const merged = Array.from(byId.values()).slice(0, GROUP_MAX_MEMBERS);
    state.update('group', g => ({ ...g, members: merged }));
    return { action: 'merged', userId: currentUserId, count: merged.length };
  }

  return { action: 'conflict', localCode: local.groupCode, incomingCode: incomingState.groupCode };
}
