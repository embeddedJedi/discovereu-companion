// js/features/buddy.js
// Buddy Matching — zero-backend peer matching backplane on GitHub Issues.
//
// Exports:
//   getCitiesWithBuddies()          → Promise<Array> of seeded buddy cities (+isActive)
//   buildPostUrl({kind,cityId,...}) → pre-filled GitHub "new issue" URL
//   fetchRecentPosts(cityId, opts)  → Promise<Array> normalised issues, SWR-cached
//
// Privacy posture (hard contract):
//   - The only network contact with github.com is an anonymous GET to the
//     public Issues REST endpoint. No tokens, no writes, no PII ever sent.
//   - Responses are filtered to a strict whitelist: id, login, avatar_url,
//     title, body, created_at, labels. `author_association`, email, etc. are
//     never read off the response object.

import { idbGet, idbPut } from '../utils/storage.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const GH_OWNER = 'embeddedJedi';
const GH_REPO  = 'discovereu-companion';
const GH_API   = 'https://api.github.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const IDB_STORE = 'buddyCache';

const KIND_WHITELIST = ['local', 'mentor', 'traveler'];

// ─── Memoised seed loader ────────────────────────────────────────────────────
let _citiesPromise = null;

function loadBuddyCities() {
  if (_citiesPromise) return _citiesPromise;
  _citiesPromise = fetch('data/buddy-cities.json', { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error(`buddy-cities.json ${r.status}`);
      return r.json();
    })
    .catch(err => {
      _citiesPromise = null; // allow retry on next call
      throw err;
    });
  return _citiesPromise;
}

/**
 * Return the full seeded cities list from `data/buddy-cities.json`, each
 * annotated with `isActive: boolean` (mirrors the raw `active` flag so
 * callers can filter without re-reading the spec).
 */
export async function getCitiesWithBuddies() {
  const data = await loadBuddyCities();
  const cities = Array.isArray(data?.cities) ? data.cities : [];
  return cities.map(c => ({ ...c, isActive: !!c.active }));
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function cityNameFor(cityId, cities) {
  const hit = cities?.find(c => c.cityId === cityId);
  return hit?.name || cityId;
}

/**
 * Build the pre-filled GitHub new-issue URL for a buddy post.
 *
 * @param {object} opts
 * @param {'local'|'mentor'|'traveler'} opts.kind
 * @param {string} opts.cityId
 * @param {object} [opts.preferences]
 *   - handle       : GitHub-style handle (optional, placeholder used if absent)
 *   - dateRange    : free-form range string, only used for 'traveler'
 *   - cityName     : optional override; otherwise best-effort lookup from seed
 * @returns {string} fully URL-encoded href
 */
export function buildPostUrl({ kind, cityId, preferences = {} } = {}) {
  if (!KIND_WHITELIST.includes(kind)) {
    throw new Error(`buildPostUrl: invalid kind "${kind}"`);
  }
  if (!cityId || typeof cityId !== 'string') {
    throw new Error('buildPostUrl: cityId required');
  }

  const handle = (preferences.handle || '<your-handle>').trim();
  const cityName = preferences.cityName || cityId;
  const dateRange = (preferences.dateRange || '').trim();

  let title;
  if (kind === 'local') {
    title = `[Local] ${handle} hosting in ${cityName}`;
  } else if (kind === 'mentor') {
    title = `[Mentor] ${handle} — been to ${cityName}`;
  } else { // traveler
    title = `[Traveler] ${handle} in ${cityName}${dateRange ? ' ' + dateRange : ''}`;
  }

  const labels = `buddy-matching,buddy-${kind},buddy-${cityId}`;

  const url = new URL(`https://github.com/${GH_OWNER}/${GH_REPO}/issues/new`);
  url.searchParams.set('template', `buddy-${kind}.md`);
  url.searchParams.set('labels', labels);
  url.searchParams.set('title', title);
  return url.toString();
}

/**
 * Build a pre-filled report URL for a buddy post.
 * Internal helper — also used when normalising fetched posts.
 */
function buildReportUrl({ handle = '', issueUrl = '' } = {}) {
  const url = new URL(`https://github.com/${GH_OWNER}/${GH_REPO}/issues/new`);
  url.searchParams.set('template', 'buddy-report.md');
  url.searchParams.set('labels', 'buddy-matching,buddy-report');
  url.searchParams.set('title', `[Report] ${handle || 'user'}`);
  const body = [
    `Reported handle: ${handle || ''}`,
    `Offending issue: ${issueUrl || ''}`,
    '',
    'Reason:',
    ''
  ].join('\n');
  url.searchParams.set('body', body);
  return url.toString();
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

function cacheKey(cityId) { return `buddy-posts-${cityId}`; }

async function readCache(cityId) {
  try {
    const entry = await idbGet(IDB_STORE, cacheKey(cityId));
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.posts)) return null;
    return entry; // { t, posts }
  } catch (e) {
    return null;
  }
}

async function writeCache(cityId, posts) {
  try {
    await idbPut(IDB_STORE, cacheKey(cityId), { t: Date.now(), posts });
  } catch (e) {
    console.warn('[buddy] cache write failed', e);
  }
}

function kindFromLabels(labels) {
  const names = (labels || []).map(l => (typeof l === 'string' ? l : l?.name) || '');
  for (const k of KIND_WHITELIST) {
    if (names.includes(`buddy-${k}`)) return k;
  }
  return null;
}

// Strict whitelist normaliser — never touches author_association, email, etc.
function normaliseIssue(raw) {
  const login = raw?.user?.login || null;
  const avatar = raw?.user?.avatar_url || null;
  const kind = kindFromLabels(raw?.labels);
  const htmlUrl = typeof raw?.html_url === 'string' ? raw.html_url : '';
  return {
    id: raw?.id,
    user: { handle: login, avatar_url: avatar },
    title: typeof raw?.title === 'string' ? raw.title : '',
    body: typeof raw?.body === 'string' ? raw.body : '',
    createdAt: raw?.created_at || null,
    kind,
    reportUrl: buildReportUrl({ handle: login, issueUrl: htmlUrl }),
    url: htmlUrl
  };
}

async function revalidate(cityId, limit, signal) {
  const url = new URL(`${GH_API}/repos/${GH_OWNER}/${GH_REPO}/issues`);
  url.searchParams.set('labels', `buddy-matching,buddy-${cityId}`);
  url.searchParams.set('state', 'open');
  url.searchParams.set('per_page', String(limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    signal,
    headers: { 'Accept': 'application/vnd.github+json' }
  });

  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') throw new Error('rate-limited');
  }
  if (!res.ok) throw new Error(`gh-issues ${res.status}`);

  const list = await res.json();
  const arr = Array.isArray(list) ? list : [];
  // Only keep pull_request-free entries (issues, not PRs) and with a known kind.
  const posts = arr
    .filter(x => !x?.pull_request)
    .map(normaliseIssue);
  await writeCache(cityId, posts);
  return posts;
}

/**
 * Stale-while-revalidate feed for a given cityId.
 *
 * Behaviour:
 *   - If fresh cache (< 10 min) exists → return it, no network.
 *   - If stale cache exists → return it immediately, kick off background fetch.
 *   - If no cache → await a live fetch.
 *   - On 403 rate-limit → throw Error('rate-limited'). If cached data exists,
 *     it is still returned (the error only propagates when we had nothing).
 *
 * @param {string} cityId
 * @param {{limit?:number, signal?:AbortSignal}} [opts]
 * @returns {Promise<Array>}
 */
export async function fetchRecentPosts(cityId, { limit = 10, signal } = {}) {
  if (!cityId || typeof cityId !== 'string') {
    throw new Error('fetchRecentPosts: cityId required');
  }

  const cached = await readCache(cityId);
  const fresh = cached && (Date.now() - cached.t) < CACHE_TTL_MS;

  if (fresh) return cached.posts;

  if (cached) {
    // Stale: return cached, refresh in the background (fire-and-forget).
    revalidate(cityId, limit, signal).catch(err => {
      // Swallow in background; next call will try again. Rate-limit is expected.
      if (String(err?.message) !== 'rate-limited') {
        console.warn('[buddy] background revalidate failed', err);
      }
    });
    return cached.posts;
  }

  // No cache — must await live fetch.
  try {
    return await revalidate(cityId, limit, signal);
  } catch (err) {
    if (err?.message === 'rate-limited') throw err;
    throw err;
  }
}
