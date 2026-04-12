// js/features/wikivoyage-refresh.js
// Live Wikivoyage refresh adapter. Fetches country/city article HTML from
// the English Wikivoyage MediaWiki API (CORS-friendly via origin=*), caches
// parsed+sanitized HTML in localStorage for 24h, and hands it back to the
// guide UI as a safe DOM-ready string.
//
// Why: our static /data/guides.json is human-curated and stable, but users
// benefit from pulling the freshest section text on demand (e.g. transport
// prices that changed since our last refresh). This module is additive —
// static content remains the default.
//
// Rate-limit strategy: cache TTL (24h) + per-click UX means we comfortably
// stay under Wikivoyage's fair-use expectations. No explicit limiter.
//
// Attribution: all content is CC BY-SA 3.0 / GFDL. UI must show the
// "Updated from Wikivoyage {date}" caption + link back to the article.

import { cache, storage } from '../utils/storage.js';

const BASE_URL = 'https://en.wikivoyage.org/w/api.php';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const REQUEST_TIMEOUT_MS = 10_000;

// Map our guide section keys to the canonical Wikivoyage heading text.
// Wikivoyage country articles use a stable set of H2s — these are the
// sections we care about. Missing section ⇒ caller falls back to the
// whole-article lead paragraph.
const SECTION_TO_HEADING = {
  summary:      null,          // lead (no heading) → slice pre-first-heading
  whenToGo:     'Climate',
  whatToEat:    'Eat',
  transport:    'Get around',
  money:        'Buy',
  etiquette:    'Respect',
  safety:       'Stay safe',
  connectivity: 'Connect'
};

// Map country ID → Wikivoyage page title. The static guides.json also
// stores sourceUrl — we extract the title from there when possible.
const COUNTRY_TITLE_OVERRIDES = {
  CZ: 'Czech_Republic',
  UK: 'United_Kingdom',
  GB: 'United_Kingdom'
};

function titleFromCountryId(countryId, fallbackName) {
  if (COUNTRY_TITLE_OVERRIDES[countryId]) return COUNTRY_TITLE_OVERRIDES[countryId];
  if (fallbackName) return fallbackName.replace(/\s+/g, '_');
  return countryId;
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function mwFetch(title, signal) {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    format: 'json',
    prop: 'sections|text',
    redirects: '1',
    origin: '*'
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const combinedSignal = signal
    ? anySignal([signal, controller.signal])
    : controller.signal;
  try {
    const res = await fetch(`${BASE_URL}?${params}`, { signal: combinedSignal });
    if (!res.ok) throw new Error(`wikivoyage http ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`wikivoyage: ${json.error.info || 'unknown'}`);
    return json.parse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Combine multiple AbortSignals into one. */
function anySignal(signals) {
  const controller = new AbortController();
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

// ─── HTML sanitize + section slice ─────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'HR',
  'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
  'A', 'STRONG', 'EM', 'B', 'I', 'U', 'CODE', 'SPAN',
  'BLOCKQUOTE', 'SMALL'
]);

const ALLOWED_ATTRS_BY_TAG = {
  A: ['href', 'title']
};

/**
 * Sanitize a parsed Wikivoyage HTML fragment. Strips scripts/styles/iframes,
 * unknown tags (replaced with their textContent), disallowed attributes, and
 * rewrites external <a> to target="_blank" rel="noopener noreferrer".
 * Relative links (/wiki/...) are promoted to absolute en.wikivoyage.org URLs.
 */
export function sanitizeHtml(rawHtml) {
  const doc = new DOMParser().parseFromString(rawHtml || '', 'text/html');

  // Drop obvious danger elements outright.
  doc.querySelectorAll('script, style, iframe, object, embed, form, input, textarea, button, link, meta').forEach(n => n.remove());

  // Wikivoyage markup noise — edit links, nav boxes, thumbs we can't render.
  doc.querySelectorAll('.mw-editsection, .noprint, .metadata, .navbox, .mbox-small, .hatnote, table.infobox').forEach(n => n.remove());

  walkAndClean(doc.body);
  return doc.body.innerHTML.trim();
}

function walkAndClean(node) {
  const children = Array.from(node.children);
  for (const el of children) {
    const tag = el.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: replace element with its children (text preserved, markup
      // dropped). Keeps paragraphs flowing even if MW uses <div class="mw-parser-output">.
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }
    // Attr allowlist.
    const allowed = ALLOWED_ATTRS_BY_TAG[tag] || [];
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    }
    // Link rewrite.
    if (tag === 'A') {
      let href = el.getAttribute('href') || '';
      if (href.startsWith('/wiki/')) href = 'https://en.wikivoyage.org' + href;
      if (!/^https?:/i.test(href)) { el.removeAttribute('href'); }
      else {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
    walkAndClean(el);
  }
}

/**
 * Slice a specific section out of a full Wikivoyage article HTML by H2/H3
 * heading text. Returns sanitized inner HTML for that section, or null.
 */
function sliceSection(fullHtml, headingText) {
  const doc = new DOMParser().parseFromString(fullHtml, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.body;
  // Lead = everything before the first H2.
  if (headingText == null) {
    const frag = doc.createElement('div');
    for (const child of Array.from(root.children)) {
      if (child.tagName === 'H2') break;
      frag.appendChild(child.cloneNode(true));
    }
    return sanitizeHtml(frag.innerHTML);
  }
  const headings = Array.from(root.querySelectorAll('h2, h3'));
  const target = headings.find(h => headingInnerText(h).toLowerCase() === headingText.toLowerCase());
  if (!target) return null;
  const frag = doc.createElement('div');
  let cur = target.nextElementSibling;
  const targetLevel = target.tagName;
  while (cur) {
    if (cur.tagName === 'H2') break;
    if (targetLevel === 'H2' || cur.tagName !== 'H3') {
      frag.appendChild(cur.cloneNode(true));
    }
    cur = cur.nextElementSibling;
  }
  return sanitizeHtml(frag.innerHTML);
}

function headingInnerText(h) {
  // MediaWiki wraps heading text in .mw-headline.
  const span = h.querySelector('.mw-headline');
  return (span ? span.textContent : h.textContent || '').trim();
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Refresh a country section (or the whole article's lead) from Wikivoyage.
 * @param {string} countryId - e.g. "DE"
 * @param {string} [sectionId] - key from SECTION_TO_HEADING. Defaults to "summary".
 * @param {object} [opts] - { signal, title }
 * @returns {Promise<{html:string,updated:number,source:string,title:string}>}
 */
export async function refreshCountry(countryId, sectionId = 'summary', opts = {}) {
  const title = opts.title || titleFromCountryId(countryId);
  const cacheKey = `wv:country:${countryId}:${sectionId}`;
  const cached = cache.get(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const parse = await mwFetch(title, opts.signal);
  const fullHtml = parse?.text?.['*'] || '';
  if (!fullHtml) throw new Error('wikivoyage: empty article');

  const headingKey = sectionId in SECTION_TO_HEADING ? SECTION_TO_HEADING[sectionId] : null;
  let html = sliceSection(fullHtml, headingKey);
  if (!html) {
    // Fallback to lead if a specific section is missing.
    html = sliceSection(fullHtml, null);
  }
  const entry = {
    html,
    updated: Date.now(),
    source: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title)}`,
    title
  };
  cache.set(cacheKey, entry);
  return entry;
}

/**
 * Refresh a city article (whole lead). City articles have free-form
 * heading layouts so we don't slice — we return the lead paragraph block.
 */
export async function refreshCity(cityName, opts = {}) {
  const title = (opts.title || cityName).replace(/\s+/g, '_');
  const cacheKey = `wv:city:${title}`;
  const cached = cache.get(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const parse = await mwFetch(title, opts.signal);
  const fullHtml = parse?.text?.['*'] || '';
  if (!fullHtml) throw new Error('wikivoyage: empty article');

  const html = sliceSection(fullHtml, null);
  const entry = {
    html,
    updated: Date.now(),
    source: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title)}`,
    title
  };
  cache.set(cacheKey, entry);
  return entry;
}

/** Return a cached entry (≤24h old) or null. */
export function getCached(type, id) {
  return cache.get(`wv:${type}:${id}`, CACHE_TTL);
}

/** Wipe every Wikivoyage cache entry. */
export function clearCache() {
  let removed = 0;
  try {
    const prefix = 'discoveru:cache:wv:';
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(k => { localStorage.removeItem(k); removed++; });
  } catch (e) { /* ignore */ }
  return removed;
}

// Exposed for tests / consumer inspection.
export { SECTION_TO_HEADING, titleFromCountryId };
