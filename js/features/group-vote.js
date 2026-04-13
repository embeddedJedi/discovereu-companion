// js/features/group-vote.js
// URL-hash-based group vote. Up to 4 voters select favorite candidate stops
// from a shared ballot. Ballot travels entirely inside `#vote=<lz-string>`
// so it works with GitHub Pages and needs no backend.
//
// Ballot shape:
//   {
//     id:         <short id>,
//     candidates: [{ cityId, label }],
//     votes:      [{ voter, picks: [cityId, ...] }],
//     maxVoters:  4,
//     createdAt:  ISO string
//   }
//
// The URL hash is additive — we share the `#vote=` key only, which does
// not collide with the route builder's `#route=` key.

/* global LZString */

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty, escape } from '../utils/dom.js';
import { showToast } from '../ui/toast.js';

const HASH_KEY = 'vote';
const MAX_VOTERS = 4;

// ─── ID helpers ─────────────────────────────────────────────────────────────
function shortId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

// ─── Ballot encoding (LZ-string) ────────────────────────────────────────────
function compact(ballot) {
  return {
    i: ballot.id,
    c: ballot.candidates.map(c => ({ k: c.cityId || '', l: c.label })),
    v: (ballot.votes || []).map(v => ({ n: v.voter, p: v.picks })),
    m: ballot.maxVoters ?? MAX_VOTERS,
    t: ballot.createdAt
  };
}

function expand(compactBallot) {
  return {
    id: compactBallot.i,
    candidates: (compactBallot.c || []).map(c => ({ cityId: c.k || null, label: c.l })),
    votes: (compactBallot.v || []).map(v => ({ voter: v.n, picks: Array.isArray(v.p) ? v.p : [] })),
    maxVoters: compactBallot.m ?? MAX_VOTERS,
    createdAt: compactBallot.t || new Date().toISOString()
  };
}

function encode(ballot) {
  if (typeof LZString === 'undefined') return '';
  try {
    return LZString.compressToEncodedURIComponent(JSON.stringify(compact(ballot)));
  } catch (e) {
    console.warn('[group-vote] encode failed', e);
    return '';
  }
}

function decode(encoded) {
  if (typeof LZString === 'undefined' || !encoded) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return expand(JSON.parse(json));
  } catch (e) {
    console.warn('[group-vote] decode failed', e);
    return null;
  }
}

// ─── Hash read/write (co-exists with #route=) ───────────────────────────────
function readHashParams() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(hash);
}

function writeHashParam(key, value) {
  const params = readHashParams();
  if (value == null || value === '') params.delete(key);
  else params.set(key, value);
  const hash = params.toString();
  const url = `${location.pathname}${location.search}${hash ? '#' + hash : ''}`;
  try { history.replaceState(null, '', url); } catch {}
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a ballot from a list of stops, encode it into the URL hash, and copy
 * the resulting shareable URL to the clipboard. Returns { ballot, url }.
 */
export async function createBallot(candidateStops) {
  const countries = state.getSlice('countries') || [];
  const candidates = (candidateStops || []).map(stop => {
    const country = countries.find(c => c.id === stop.countryId);
    const cityId = stop.cityId || stop.countryId;
    const label = country
      ? (country.name || country.id)
      : (stop.countryId || stop.cityId || t('groupVote.unknownStop'));
    return { cityId, label: String(label) };
  }).filter(c => c.label);

  const ballot = {
    id: shortId(),
    candidates,
    votes: [],
    maxVoters: MAX_VOTERS,
    createdAt: new Date().toISOString()
  };

  const encoded = encode(ballot);
  writeHashParam(HASH_KEY, encoded);

  const url = `${location.origin}${location.pathname}${location.search}#${HASH_KEY}=${encoded}`;

  // Copy to clipboard (best-effort)
  let copied = false;
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); copied = true; } catch { /* noop */ }
  }
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copied = true;
    } catch { /* noop */ }
  }

  return { ballot, url, copied };
}

/** Read the current URL hash and return the ballot (or null). */
export function readBallot() {
  const params = readHashParams();
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;
  return decode(encoded);
}

/**
 * Append a vote to the current ballot and update the URL in-place.
 * Throws if max voters reached or voter name already used.
 * Returns the updated ballot.
 */
export function submitVote(voter, picks) {
  const ballot = readBallot();
  if (!ballot) throw new Error('[group-vote] no ballot in URL');

  const cleanName = String(voter || '').trim();
  if (!cleanName) throw new Error('[group-vote] voter name required');

  const cleanPicks = Array.isArray(picks)
    ? picks.map(p => String(p)).filter(Boolean)
    : [];

  if (ballot.votes.length >= (ballot.maxVoters || MAX_VOTERS)) {
    const err = new Error('[group-vote] max voters reached');
    err.code = 'MAX_VOTERS';
    throw err;
  }
  const lower = cleanName.toLowerCase();
  if (ballot.votes.some(v => String(v.voter).toLowerCase() === lower)) {
    const err = new Error('[group-vote] voter already voted');
    err.code = 'DUPLICATE_VOTER';
    throw err;
  }

  ballot.votes = [...ballot.votes, { voter: cleanName, picks: cleanPicks }];
  const encoded = encode(ballot);
  writeHashParam(HASH_KEY, encoded);
  return ballot;
}

/**
 * Tally picks across all votes and render a horizontal bar chart (pure CSS).
 * Each bar's width is proportional to the top candidate's vote count.
 */
export function renderResults(ballot, container) {
  empty(container);
  if (!ballot || !Array.isArray(ballot.candidates)) return;

  const tally = new Map();
  for (const c of ballot.candidates) tally.set(c.cityId, 0);
  for (const vote of ballot.votes || []) {
    for (const pick of vote.picks || []) {
      if (tally.has(pick)) tally.set(pick, tally.get(pick) + 1);
    }
  }

  const rows = ballot.candidates
    .map(c => ({ label: c.label, cityId: c.cityId, count: tally.get(c.cityId) || 0 }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(1, ...rows.map(r => r.count));
  const totalVoters = (ballot.votes || []).length;

  const head = h('div', { class: 'gv-results-head' }, [
    h('h4', null, t('groupVote.results')),
    h('span', { class: 'text-muted small' }, `${totalVoters}/${ballot.maxVoters || MAX_VOTERS}`)
  ]);
  container.appendChild(head);

  const list = h('ul', { class: 'gv-results', role: 'list' });
  for (const row of rows) {
    const pct = Math.round((row.count / maxCount) * 100);
    const item = h('li', { class: 'gv-result-row' }, [
      h('div', { class: 'gv-result-label' }, [
        h('span', { class: 'gv-result-name' }, row.label),
        h('span', { class: 'gv-result-count' }, String(row.count))
      ]),
      h('div', {
        class: 'gv-result-track',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': String(maxCount),
        'aria-valuenow': String(row.count),
        'aria-label': `${row.label}: ${row.count}`
      }, [
        h('div', { class: 'gv-result-bar', style: { width: `${pct}%` } })
      ])
    ]);
    list.appendChild(item);
  }
  container.appendChild(list);
}

// ─── Generic options vote API (v1.7) ────────────────────────────────────────
//
// In addition to the v1.0 4-voter ballot above, v1.7 needs a generic
// options-based vote that can be reused across topics ("meeting-point",
// "next-city", etc.) and optionally scoped to a known group.
//
// Storage model: each generic vote is stored under
//   localStorage["discoveru:votes:<voteId>"] = { topic, options, votes:{memberId:optionId}, createdAt, expiresAt, groupUrl }
// Ephemeral: entries older than expiresAt are dropped on read.

const GENERIC_PREFIX = 'discoveru:votes:';
const GENERIC_HASH_KEY = 'gvote';

function nowMs() { return Date.now(); }

function loadGenericVote(voteId) {
  try {
    const raw = localStorage.getItem(GENERIC_PREFIX + voteId);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.expiresAt && obj.expiresAt < nowMs()) {
      localStorage.removeItem(GENERIC_PREFIX + voteId);
      return null;
    }
    return obj;
  } catch (e) {
    console.warn('[group-vote] loadGenericVote failed', e);
    return null;
  }
}

function saveGenericVote(voteId, vote) {
  try {
    localStorage.setItem(GENERIC_PREFIX + voteId, JSON.stringify(vote));
  } catch (e) {
    console.warn('[group-vote] saveGenericVote failed', e);
  }
}

function encodeGenericState(vote) {
  if (typeof LZString === 'undefined') return '';
  try {
    const compactState = {
      i: vote.voteId,
      k: vote.topic,
      o: vote.options.map(o => ({ i: o.id, l: o.label, m: o.meta || null })),
      v: vote.votes || {},
      g: vote.groupUrl || null,
      t: vote.createdAt,
      e: vote.expiresAt
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(compactState));
  } catch (e) {
    console.warn('[group-vote] encodeGenericState failed', e);
    return '';
  }
}

function decodeGenericState(encoded) {
  if (typeof LZString === 'undefined' || !encoded) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const c = JSON.parse(json);
    return {
      voteId: c.i,
      topic: c.k,
      options: (c.o || []).map(o => ({ id: o.i, label: o.l, meta: o.m || null })),
      votes: c.v || {},
      groupUrl: c.g || null,
      createdAt: c.t,
      expiresAt: c.e
    };
  } catch (e) {
    console.warn('[group-vote] decodeGenericState failed', e);
    return null;
  }
}

/**
 * Decode a vote share URL hash like `#/vote?v=<base64>` or `#gvote=<base64>`.
 * Returns the inflated generic-vote object, or null.
 */
export function decodeVoteUrl(hash) {
  if (!hash) return null;
  const raw = String(hash).replace(/^#\/?/, '');
  // form A: vote?v=<state>
  const qIdx = raw.indexOf('?');
  if (qIdx >= 0) {
    const params = new URLSearchParams(raw.slice(qIdx + 1));
    const v = params.get('v');
    if (v) return decodeGenericState(v);
  }
  // form B: gvote=<state> (URLSearchParams-style)
  const params = new URLSearchParams(raw);
  const v = params.get(GENERIC_HASH_KEY) || params.get('v');
  if (v) return decodeGenericState(v);
  return null;
}

/**
 * Create a generic options vote and return helpers.
 *
 * @param {object}   args
 * @param {string}   args.topic         e.g. 'meeting-point', 'next-city'
 * @param {Array}    args.options       [{ id, label, meta }]
 * @param {string=}  args.groupUrl      optional — scopes vote to a group
 * @param {number=}  args.expiryHours   default 48
 * @returns {{ voteId, shareUrl, cast, tally, getState, close }}
 */
export function createGenericVote({ topic, options, groupUrl, expiryHours = 48 } = {}) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('[group-vote] createGenericVote: topic required');
  }
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error('[group-vote] createGenericVote: options[] required');
  }

  const voteId = shortId();
  const createdAt = nowMs();
  const expiresAt = createdAt + (expiryHours * 3600 * 1000);

  const vote = {
    voteId,
    topic,
    options: options.map(o => ({
      id: String(o.id),
      label: String(o.label ?? o.id),
      meta: o.meta ?? null
    })),
    votes: {},                  // memberId -> optionId
    groupUrl: groupUrl || null,
    createdAt,
    expiresAt,
    closed: false
  };

  saveGenericVote(voteId, vote);

  const encoded = encodeGenericState(vote);
  const shareUrl = `${location.origin}${location.pathname}${location.search}#/vote?v=${encoded}&topic=${encodeURIComponent(topic)}`;

  function cast(memberId, optionId) {
    if (!memberId) throw new Error('[group-vote] cast: memberId required');
    const current = loadGenericVote(voteId) || vote;
    if (current.closed) {
      const err = new Error('[group-vote] vote closed');
      err.code = 'VOTE_CLOSED';
      throw err;
    }
    if (!current.options.some(o => o.id === String(optionId))) {
      const err = new Error('[group-vote] unknown optionId');
      err.code = 'UNKNOWN_OPTION';
      throw err;
    }
    current.votes[String(memberId)] = String(optionId);
    saveGenericVote(voteId, current);
    return current;
  }

  function tally() {
    const current = loadGenericVote(voteId) || vote;
    const counts = {};
    for (const opt of current.options) counts[opt.id] = 0;
    let totalVotes = 0;
    for (const optId of Object.values(current.votes || {})) {
      if (counts[optId] != null) {
        counts[optId] += 1;
        totalVotes += 1;
      }
    }
    return { ...counts, totalVotes };
  }

  function getResult() {
    const current = loadGenericVote(voteId) || vote;
    const counts = {};
    for (const opt of current.options) counts[opt.id] = 0;
    for (const optId of Object.values(current.votes || {})) {
      if (counts[optId] != null) counts[optId] += 1;
    }
    let max = -1;
    let winners = [];
    for (const [id, c] of Object.entries(counts)) {
      if (c > max) { max = c; winners = [id]; }
      else if (c === max) { winners.push(id); }
    }
    return {
      winner: winners.length === 1 ? winners[0] : null,
      ties: winners.length > 1 ? winners : [],
      tally: counts
    };
  }

  function close() {
    const current = loadGenericVote(voteId) || vote;
    current.closed = true;
    saveGenericVote(voteId, current);
    return getResult();
  }

  function getState() {
    return loadGenericVote(voteId) || vote;
  }

  return { voteId, shareUrl, cast, tally, getResult, close, getState };
}

// ─── Plan-aligned imperative API (startVote / castVote / closeVote / getResult)
// One "active" generic vote at a time per page session. Backed by the same
// LocalStorage as createGenericVote() so callers can mix and match.

let _activeVoteHandle = null;

/**
 * Plan-aligned vote starter. Branches on presence of `kind` so legacy
 * route-template callers (which don't pass `kind`) are unaffected.
 *
 * @param {object} args
 * @param {string} args.kind        'route' | 'meeting-point' | string
 * @param {Array}  args.options     [{id,label,meta}]
 * @param {Array}  args.voterIds    member ids allowed to vote (informational)
 */
export function startVote(args = {}) {
  if (!args || !args.kind) {
    throw new Error('[group-vote] startVote: { kind, options, voterIds } required (legacy callers should use createBallot)');
  }
  const handle = createGenericVote({
    topic: args.kind,
    options: args.options || [],
    groupUrl: args.groupUrl || null
  });
  // Stash voterIds on the persisted record for downstream UIs.
  const cur = handle.getState();
  cur.voterIds = Array.isArray(args.voterIds) ? args.voterIds.map(String) : [];
  saveGenericVote(handle.voteId, cur);
  _activeVoteHandle = handle;
  return handle;
}

export function castVote(memberId, optionId) {
  if (!_activeVoteHandle) throw new Error('[group-vote] castVote: no active vote — call startVote() first');
  return _activeVoteHandle.cast(memberId, optionId);
}

export function closeVote() {
  if (!_activeVoteHandle) throw new Error('[group-vote] closeVote: no active vote');
  return _activeVoteHandle.close();
}

export function getResult() {
  if (!_activeVoteHandle) throw new Error('[group-vote] getResult: no active vote');
  return _activeVoteHandle.getResult();
}

// ─── Kesfet card integration (renderInto) ───────────────────────────────────
export function renderInto(container) {
  empty(container);
  const ballot = readBallot();
  if (ballot) renderBallotView(container, ballot);
  else renderStartView(container);
}

function renderStartView(container) {
  const route = state.getSlice('route') || { stops: [] };
  const stops = Array.isArray(route.stops) ? route.stops : [];

  container.appendChild(h('p', { class: 'text-muted' }, t('groupVote.description')));

  if (stops.length < 3) {
    container.appendChild(h('p', { class: 'gv-empty' }, t('groupVote.needMoreStops')));
    return;
  }

  const preview = h('ul', { class: 'gv-preview' });
  const countries = state.getSlice('countries') || [];
  for (const stop of stops) {
    const country = countries.find(c => c.id === stop.countryId);
    const label = country ? (country.name || country.id) : (stop.countryId || '—');
    preview.appendChild(h('li', null, String(label)));
  }
  container.appendChild(preview);

  const startBtn = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    onclick: async () => {
      const { url, copied } = await createBallot(stops);
      showToast(copied ? t('groupVote.voteShared') : url, copied ? 'success' : 'info');
      renderInto(container);
    }
  }, t('groupVote.startVote'));
  container.appendChild(startBtn);
}

function renderBallotView(container, ballot) {
  const maxReached = ballot.votes.length >= (ballot.maxVoters || MAX_VOTERS);

  // Vote form (only if capacity remains)
  if (!maxReached) {
    const form = h('form', { class: 'gv-form', onsubmit: (ev) => ev.preventDefault() });

    form.appendChild(h('label', { for: 'gvVoterName' }, t('groupVote.voterName')));
    const nameInput = h('input', {
      id: 'gvVoterName',
      type: 'text',
      class: 'input',
      autocomplete: 'off',
      maxlength: '32',
      required: true
    });
    form.appendChild(nameInput);

    form.appendChild(h('fieldset', { class: 'gv-candidates' }, [
      h('legend', null, t('groupVote.selectCandidates')),
      ...ballot.candidates.map((c, i) => {
        const id = `gvCand_${i}`;
        return h('label', { class: 'gv-candidate', for: id }, [
          h('input', { id, type: 'checkbox', value: c.cityId, class: 'gv-candidate-input' }),
          h('span', null, c.label)
        ]);
      })
    ]));

    const submitBtn = h('button', {
      class: 'btn btn-primary',
      type: 'submit',
      onclick: () => {
        const voter = nameInput.value.trim();
        if (!voter) {
          showToast(t('groupVote.voterName'), 'warning');
          nameInput.focus();
          return;
        }
        const picks = Array.from(form.querySelectorAll('.gv-candidate-input:checked'))
          .map(el => el.value);
        try {
          submitVote(voter, picks);
          showToast(t('groupVote.voteShared'), 'success');
          renderInto(container);
        } catch (err) {
          if (err.code === 'MAX_VOTERS') {
            showToast(t('groupVote.maxVotersReached'), 'warning');
          } else if (err.code === 'DUPLICATE_VOTER') {
            showToast(t('groupVote.voterAlreadyVoted'), 'warning');
          } else {
            console.warn('[group-vote]', err);
          }
        }
      }
    }, t('groupVote.submitVote'));
    form.appendChild(submitBtn);
    container.appendChild(form);
  } else {
    container.appendChild(h('p', { class: 'text-muted' }, t('groupVote.maxVotersReached')));
  }

  // Results
  const resultsEl = h('div', { class: 'gv-results-wrap', 'aria-live': 'polite' });
  renderResults(ballot, resultsEl);
  container.appendChild(resultsEl);
}
