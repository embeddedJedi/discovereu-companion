// js/features/journal.js
// GPS Trip Journal — auto location logs + manual entries with photos/notes.
// All data stays on-device (IndexedDB `journalEntries`). The only network
// call is OpenStreetMap Nominatim for reverse-geocoding city names, which
// is aggressively cached per-coordinate in localStorage (30-day TTL) to
// respect Nominatim's usage policy.

/* global html2canvas */

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty, escape } from '../utils/dom.js';
import { cache } from '../utils/storage.js';
import { idbPut, idbGetAll, idbDelete, idbClear, idbGet } from '../utils/storage.js';
import { stripExif } from '../utils/image.js';

const STORE = 'journalEntries';
const GEOCODE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

let rootEl = null;
let entriesCache = null;
const objectUrls = new Set();

// ─── Data API ──────────────────────────────────────────────────────────────

function genId() {
  return 'j_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Request current geolocation and save a GPS entry. */
export async function requestGeoLog() {
  if (!('geolocation' in navigator)) {
    throw new Error('geolocation-unsupported');
  }
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000
    });
  });
  const entry = {
    id: genId(),
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    ts: Date.now(),
    source: 'gps',
    note: '',
    photoKeys: []
  };
  await idbPut(STORE, entry.id, entry);
  entriesCache = null;
  return entry;
}

/**
 * Add a manual entry. `photos` is an array of Files; they are re-encoded
 * (EXIF stripped) and stored as Blobs under separate IDB keys.
 */
export async function addManualEntry({ cityId = null, note = '', photos = [], ts = Date.now(), lat = null, lng = null } = {}) {
  const photoKeys = [];
  for (const file of photos.slice(0, 4)) {
    try {
      const blob = await stripExif(file);
      const pk = 'p_' + genId();
      await idbPut(STORE, pk, blob);
      photoKeys.push(pk);
    } catch (err) {
      console.warn('[journal] photo failed', err);
    }
  }
  const entry = {
    id: genId(),
    cityId,
    lat,
    lng,
    ts,
    source: 'manual',
    note: (note || '').slice(0, 280),
    photoKeys
  };
  await idbPut(STORE, entry.id, entry);
  entriesCache = null;
  return entry;
}

/** Read all entries, sort desc by ts, group by YYYY-MM-DD. */
export async function readJournal() {
  if (entriesCache) return entriesCache;
  const rows = await idbGetAll(STORE);
  const entries = rows
    .map(r => r.value)
    .filter(v => v && typeof v === 'object' && v.id && v.ts);
  entries.sort((a, b) => b.ts - a.ts);
  const groups = new Map();
  for (const e of entries) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(e);
  }
  entriesCache = { entries, groups: Array.from(groups.entries()) };
  return entriesCache;
}

export async function updateEntry(id, patch) {
  const current = await idbGet(STORE, id);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (typeof next.note === 'string') next.note = next.note.slice(0, 280);
  await idbPut(STORE, id, next);
  entriesCache = null;
  return next;
}

export async function deleteEntry(id) {
  const current = await idbGet(STORE, id);
  if (current?.photoKeys) {
    for (const pk of current.photoKeys) await idbDelete(STORE, pk);
  }
  await idbDelete(STORE, id);
  entriesCache = null;
}

/** Wipe all journal data (entries + photos). */
export async function clearJournal() {
  await idbClear(STORE);
  entriesCache = null;
  revokeObjectUrls();
}

// ─── Reverse geocoding (Nominatim, cached) ─────────────────────────────────

function geoKey(lat, lng, lang) {
  // Round to 3 decimals (~110m) to share cache across nearby points.
  const la = Number(lat).toFixed(3);
  const ln = Number(lng).toFixed(3);
  return `geo:${lang}:${la}:${ln}`;
}

export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  const lang = state.getSlice('language') || 'en';
  const key = geoKey(lat, lng, lang);
  const cached = cache.get(key, GEOCODE_TTL);
  if (cached) return cached;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&zoom=10&accept-language=${encodeURIComponent(lang)}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('nominatim-' + resp.status);
    const json = await resp.json();
    const a = json.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state || '';
    const country = a.country || '';
    const result = { city, country, displayName: json.display_name || '' };
    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn('[journal] reverse geocode failed', err);
    return null;
  }
}

// ─── UI ────────────────────────────────────────────────────────────────────

function revokeObjectUrls() {
  for (const url of objectUrls) {
    try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
  }
  objectUrls.clear();
}

async function loadPhotoUrl(pk) {
  const blob = await idbGet(STORE, pk);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function fmtDay(iso) {
  try {
    const lang = state.getSlice('language') || 'en';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(lang, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { return iso; }
}

/** Entry point called by kesfet.js card expansion. */
export async function renderInto(container) {
  rootEl = container;
  await mount(container);
}

export async function mount(container) {
  rootEl = container;
  empty(rootEl);
  revokeObjectUrls();

  rootEl.appendChild(h('p', { class: 'text-muted small journal-privacy' }, t('journal.privacyNote')));

  const actions = h('div', { class: 'journal-actions' }, [
    h('button', {
      class: 'btn btn-primary',
      type: 'button',
      onclick: () => handleLogLocation()
    }, t('journal.logLocation')),
    h('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onclick: () => openManualModal()
    }, t('journal.addManual')),
    h('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onclick: () => handleExport()
    }, t('journal.export'))
  ]);
  rootEl.appendChild(actions);

  const status = h('div', { class: 'journal-status', role: 'status', 'aria-live': 'polite' });
  rootEl.appendChild(status);

  const timeline = h('div', { class: 'journal-timeline', id: 'journalTimeline' });
  rootEl.appendChild(timeline);

  rootEl.appendChild(h('button', {
    class: 'btn btn-danger',
    type: 'button',
    style: { marginTop: 'var(--space-4)' },
    onclick: () => handleClear()
  }, t('journal.clear')));

  await renderTimeline(timeline);
}

async function renderTimeline(timeline) {
  empty(timeline);
  const { entries, groups } = await readJournal();
  if (!entries.length) {
    timeline.appendChild(h('p', { class: 'text-muted journal-empty' }, t('journal.empty')));
    return;
  }
  for (const [day, dayEntries] of groups) {
    const section = h('section', { class: 'journal-day' });
    section.appendChild(h('h3', { class: 'journal-day-header' }, fmtDay(day)));
    for (const entry of dayEntries) {
      section.appendChild(await renderEntry(entry));
    }
    timeline.appendChild(section);
  }
}

async function renderEntry(entry) {
  const card = h('article', { class: 'journal-entry', 'data-id': entry.id });

  const head = h('header', { class: 'journal-entry-head' }, [
    h('time', { class: 'journal-entry-time' }, fmtTime(entry.ts)),
    h('span', {
      class: `journal-entry-badge journal-entry-badge--${entry.source}`
    }, entry.source === 'gps' ? t('journal.source.gps') : t('journal.source.manual')),
    h('span', { class: 'journal-entry-city', 'data-city': entry.id }, entry.cityId || '…'),
    h('button', {
      class: 'btn btn-ghost btn-sm journal-entry-delete',
      type: 'button',
      'aria-label': t('journal.clear'),
      onclick: async () => {
        await deleteEntry(entry.id);
        const timeline = document.getElementById('journalTimeline');
        if (timeline) await renderTimeline(timeline);
      }
    }, '\u2715')
  ]);
  card.appendChild(head);

  // Reverse-geocode async (GPS / manual entries that carry coords).
  if ((entry.lat != null && entry.lng != null)) {
    reverseGeocode(entry.lat, entry.lng).then(info => {
      const cityEl = card.querySelector('.journal-entry-city');
      if (!cityEl) return;
      if (info && info.city) {
        cityEl.textContent = info.country ? `${info.city}, ${info.country}` : info.city;
      } else {
        cityEl.textContent = `${entry.lat.toFixed(3)}, ${entry.lng.toFixed(3)}`;
      }
    });
  } else if (!entry.cityId) {
    head.querySelector('.journal-entry-city').textContent = '';
  }

  // Photos.
  if (entry.photoKeys && entry.photoKeys.length) {
    const grid = h('div', { class: 'journal-entry-photos' });
    for (const pk of entry.photoKeys.slice(0, 4)) {
      const url = await loadPhotoUrl(pk);
      if (!url) continue;
      const img = h('img', {
        class: 'journal-entry-photo',
        src: url,
        alt: '',
        loading: 'lazy',
        onclick: () => openPhotoViewer(url)
      });
      grid.appendChild(img);
    }
    card.appendChild(grid);
  }

  // Note (editable textarea).
  const note = h('textarea', {
    class: 'journal-entry-note input',
    maxlength: '280',
    placeholder: t('journal.notePlaceholder'),
    'aria-label': t('journal.noteLabel'),
    onblur: async (ev) => {
      const val = ev.target.value || '';
      if (val !== (entry.note || '')) {
        await updateEntry(entry.id, { note: val });
      }
    }
  });
  note.value = entry.note || '';
  card.appendChild(note);

  return card;
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleLogLocation() {
  const status = rootEl?.querySelector('.journal-status');
  if (status) status.textContent = '…';
  try {
    await requestGeoLog();
    if (status) status.textContent = '';
    const timeline = document.getElementById('journalTimeline');
    if (timeline) await renderTimeline(timeline);
  } catch (err) {
    if (status) status.textContent = t('journal.permissionDenied');
    console.warn('[journal] geo log failed', err);
  }
}

async function handleClear() {
  if (!confirm(t('journal.clearConfirm'))) return;
  await clearJournal();
  const timeline = document.getElementById('journalTimeline');
  if (timeline) await renderTimeline(timeline);
}

async function handleExport() {
  const timeline = document.getElementById('journalTimeline');
  if (!timeline) return;
  await exportTimeline(timeline);
}

/** Export the mounted timeline element to a PNG download. */
export async function exportTimeline(container) {
  if (typeof html2canvas === 'undefined') {
    alert(t('journal.permissionDenied'));
    return;
  }
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg') || '#ffffff',
      scale: window.devicePixelRatio || 2,
      useCORS: true
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovereu-journal-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('[journal] export failed', err);
  }
}

// ─── Modal: manual entry ───────────────────────────────────────────────────

function openManualModal() {
  const overlay = h('div', {
    class: 'modal-overlay journal-modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    onclick: (ev) => { if (ev.target === overlay) close(); }
  });
  const noteEl = h('textarea', {
    class: 'input',
    maxlength: '280',
    placeholder: t('journal.notePlaceholder'),
    'aria-label': t('journal.noteLabel'),
    rows: '4'
  });
  const photoInput = h('input', {
    type: 'file',
    accept: 'image/*',
    multiple: 'multiple',
    'aria-label': t('journal.photosLabel')
  });
  const timeInput = h('input', {
    type: 'datetime-local',
    class: 'input',
    value: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  });

  const close = () => { overlay.remove(); };

  const saveBtn = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    onclick: async () => {
      const files = Array.from(photoInput.files || []);
      const ts = timeInput.value ? new Date(timeInput.value).getTime() : Date.now();
      saveBtn.disabled = true;
      try {
        await addManualEntry({ note: noteEl.value, photos: files, ts });
        close();
        const timeline = document.getElementById('journalTimeline');
        if (timeline) await renderTimeline(timeline);
      } catch (err) {
        console.error('[journal] save failed', err);
        saveBtn.disabled = false;
      }
    }
  }, t('journal.addManual'));

  const cancelBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: close }, '\u2715');

  const modal = h('div', { class: 'modal journal-modal' }, [
    h('header', { class: 'modal-head' }, [
      h('h3', null, t('journal.addManual')),
      cancelBtn
    ]),
    h('div', { class: 'modal-body' }, [
      h('label', null, t('journal.noteLabel')),
      noteEl,
      h('label', { style: { marginTop: 'var(--space-2)' } }, t('journal.photosLabel')),
      photoInput,
      h('label', { style: { marginTop: 'var(--space-2)' } }, 'Time'),
      timeInput
    ]),
    h('footer', { class: 'modal-foot' }, [saveBtn])
  ]);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  noteEl.focus();
}

function openPhotoViewer(url) {
  const overlay = h('div', {
    class: 'modal-overlay journal-photo-viewer',
    role: 'dialog',
    'aria-modal': 'true',
    onclick: () => overlay.remove()
  }, [
    h('img', { src: url, alt: '', style: { maxWidth: '95vw', maxHeight: '95vh' } })
  ]);
  document.body.appendChild(overlay);
}

export function unmount() {
  revokeObjectUrls();
  rootEl = null;
  entriesCache = null;
}
