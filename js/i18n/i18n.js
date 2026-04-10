// js/i18n/i18n.js
// Minimal translation engine.
// Usage:
//   await i18n.load('en');
//   t('panel.empty.message')                // returns translated string
//   t('budget.total', { amount: '€1,200' }) // supports {placeholders}
//   i18n.apply(root)                        // fill all data-i18n elements in a DOM subtree

import { state } from '../state.js';

const SUPPORTED = ['en', 'tr', 'de', 'fr', 'es', 'it'];
const BASE_PATH = 'i18n/';

let current = 'en';
let dict = {};
let fallback = {};

async function fetchLanguage(lang) {
  const response = await fetch(`${BASE_PATH}${lang}.json`);
  if (!response.ok) throw new Error(`[i18n] failed to load ${lang}: ${response.status}`);
  return response.json();
}

/** Load a language and switch to it. EN is always loaded as fallback. */
export async function load(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'en';

  // Always load EN as fallback on first call
  if (Object.keys(fallback).length === 0) {
    fallback = await fetchLanguage('en');
  }

  if (lang === 'en') {
    dict = fallback;
  } else {
    try {
      dict = await fetchLanguage(lang);
    } catch (e) {
      console.warn('[i18n] falling back to EN', e);
      dict = fallback;
    }
  }

  current = lang;
  document.documentElement.setAttribute('lang', lang);
  state.set('language', lang);
  applyAll();
}

/** Resolve a dotted key, e.g. "panel.empty.message". */
function resolve(obj, path) {
  const parts = path.split('.');
  let node = obj;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[p];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translate a key with optional placeholder substitution. */
export function t(key, vars = null) {
  let value = resolve(dict, key) ?? resolve(fallback, key) ?? key;
  if (vars && typeof value === 'string') {
    value = value.replace(/\{(\w+)\}/g, (_, name) => vars[name] != null ? String(vars[name]) : `{${name}}`);
  }
  return value;
}

/** Return current language code. */
export function getLanguage() { return current; }

/** Fill text content and aria-labels for a subtree. */
export function apply(root = document) {
  // textContent
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // aria-label
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    el.setAttribute('aria-label', t(key));
  });
  // placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  // title
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', t(key));
  });
}

/** Convenience for "apply to whole document". */
export function applyAll() { apply(document); }

export const i18n = { load, t, apply, applyAll, getLanguage };
