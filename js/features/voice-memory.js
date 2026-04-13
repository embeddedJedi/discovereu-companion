// js/features/voice-memory.js
// Voice Memory Capsule — daily 30s audio memories recorded via
// MediaRecorder API and persisted as Blobs in IndexedDB (store:
// `voiceMemories`, keyed by `YYYY-MM-DD`).
//
// DOM-free core + a `mount(container)` renderer for the Fun page.
//
// Low-bandwidth (v1.5 a11y overlay)
// ---------------------------------
// This module is already lazy — `navigator.mediaDevices.getUserMedia`
// is only called when the user clicks the record button inside
// `handleRecordClick`, and `mount()` performs no network / media work
// beyond `isSupported()` feature detection. The `shouldDefer('voice-
// memory')` gate is therefore consulted defensively at click time so
// a user who flips low-bandwidth on mid-session is not re-prompted for
// mic permission; UI mount stays untouched so the rest of the Fun
// page keeps working.

import { idbPut, idbGet, idbDelete, idbGetAll } from '../utils/storage.js';
import { h, empty } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { shouldDefer } from './low-bw.js';

const STORE = 'voiceMemories';
const MAX_DURATION_MS = 30_000;
const TICK_INTERVAL_MS = 100;

// ─── Feature detection ──────────────────────────────────────────────────────
export function isSupported() {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function pickMimeType() {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of prefs) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) { /* ignore */ }
  }
  return '';
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Recording ──────────────────────────────────────────────────────────────
/**
 * startRecording(onTick, onComplete)
 *   onTick(elapsedSec)       — fires every TICK_INTERVAL_MS (number, seconds)
 *   onComplete(blob, meta)   — called after stop with { duration, mimeType }
 * Returns { stop, cancel } — stop() finalises early, cancel() aborts without blob.
 * Throws on permission denial or unsupported environment.
 */
export async function startRecording(onTick, onComplete) {
  if (!isSupported()) throw new Error('MediaRecorder unsupported');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const e = new Error('permission-denied');
    e.cause = err;
    throw e;
  }

  const mimeType = pickMimeType();
  const rec = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  const chunks = [];
  const startedAt = performance.now();
  let tickId = null;
  let autoStopId = null;
  let stopped = false;
  let cancelled = false;

  rec.addEventListener('dataavailable', (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  });

  rec.addEventListener('stop', () => {
    stream.getTracks().forEach(tr => tr.stop());
    if (tickId) clearInterval(tickId);
    if (autoStopId) clearTimeout(autoStopId);
    if (cancelled) return;
    const duration = (performance.now() - startedAt) / 1000;
    const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
    try { onComplete && onComplete(blob, { duration, mimeType: blob.type }); }
    catch (err) { console.error('[voice-memory] onComplete threw', err); }
  });

  rec.start();

  tickId = setInterval(() => {
    if (stopped) return;
    const elapsedSec = (performance.now() - startedAt) / 1000;
    try { onTick && onTick(elapsedSec); } catch (_) { /* ignore */ }
  }, TICK_INTERVAL_MS);

  autoStopId = setTimeout(() => {
    if (rec.state === 'recording') rec.stop();
  }, MAX_DURATION_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    if (rec.state === 'recording') rec.stop();
  }

  function cancel() {
    if (stopped) return;
    stopped = true;
    cancelled = true;
    if (rec.state === 'recording') rec.stop();
  }

  return { stop, cancel };
}

// ─── Persistence ────────────────────────────────────────────────────────────
/**
 * Save a Blob for the given date (default: today). Returns true on save,
 * false if a memory already exists for that date and the user declined
 * to overwrite.
 */
export async function saveMemory(blob, date) {
  if (!(blob instanceof Blob)) throw new Error('[voice-memory] blob required');
  const key = date || todayKey();
  const existing = await idbGet(STORE, key);
  if (existing && typeof confirm === 'function') {
    if (!confirm(t('voiceMemory.overwriteConfirm'))) return false;
  }
  const record = {
    blob,
    date: key,
    size: blob.size,
    mimeType: blob.type || 'audio/webm',
    createdAt: new Date().toISOString()
  };
  await idbPut(STORE, key, record);
  return true;
}

export async function listMemories() {
  const rows = await idbGetAll(STORE);
  return rows
    .map(({ key, value }) => ({
      date: key,
      size: value?.size || value?.blob?.size || 0,
      mimeType: value?.mimeType || value?.blob?.type || 'audio/webm',
      createdAt: value?.createdAt || null
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Return an object URL for playback, or null if no memory for that date. */
export async function getMemory(date) {
  const record = await idbGet(STORE, date);
  if (!record || !record.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteMemory(date) {
  return idbDelete(STORE, date);
}

// ─── UI ─────────────────────────────────────────────────────────────────────
// The UI lives in this module so it can be lazy-loaded by kesfet.js via
// `renderInto(container)` (alias of `mount`).

let activeRecording = null; // { stop, cancel }
let ringEl = null;
let timerEl = null;
let recordBtn = null;
let statusEl = null;
let listEl = null;
let hostEl = null;

const RING_CIRCUMFERENCE = 2 * Math.PI * 45; // r=45

export async function mount(container) {
  hostEl = container;
  empty(container);

  if (!isSupported()) {
    container.appendChild(renderUnsupported());
    return;
  }

  const wrap = h('div', { class: 'voice-memory' });

  // Description
  wrap.appendChild(h('p', { class: 'voice-memory-desc text-muted' }, t('voiceMemory.description')));

  // Recorder
  const recorder = h('div', { class: 'voice-memory-recorder' });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'voice-ring');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', '45');
  track.setAttribute('class', 'voice-ring-track');
  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.setAttribute('cx', '50'); progress.setAttribute('cy', '50'); progress.setAttribute('r', '45');
  progress.setAttribute('class', 'voice-ring-progress');
  progress.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
  progress.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
  svg.appendChild(track); svg.appendChild(progress);
  ringEl = progress;

  recordBtn = h('button', {
    class: 'voice-record-btn',
    type: 'button',
    'aria-label': t('voiceMemory.record')
  }, [h('span', { class: 'voice-record-icon', 'aria-hidden': 'true' }, '\uD83C\uDFA4')]);
  recordBtn.addEventListener('click', handleRecordClick);
  recordBtn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleRecordClick(); }
  });

  const btnWrap = h('div', { class: 'voice-record-wrap' }, [svg, recordBtn]);

  timerEl = h('div', { class: 'voice-timer', 'aria-hidden': 'true' }, '0:00 / 0:30');
  statusEl = h('div', {
    class: 'voice-status',
    role: 'status',
    'aria-live': 'polite'
  }, t('voiceMemory.record'));

  recorder.appendChild(btnWrap);
  recorder.appendChild(timerEl);
  recorder.appendChild(statusEl);
  wrap.appendChild(recorder);

  // Memory list
  listEl = h('ul', { class: 'voice-memory-list', 'aria-label': t('voiceMemory.savedToday') });
  wrap.appendChild(listEl);

  container.appendChild(wrap);
  await refreshList();
}

export { mount as renderInto };

function renderUnsupported() {
  return h('div', { class: 'voice-memory-unsupported' }, [
    h('p', null, t('voiceMemory.notSupported'))
  ]);
}

async function handleRecordClick() {
  if (activeRecording) {
    activeRecording.stop();
    return;
  }
  // Low-bandwidth gate — avoid prompting for mic permission / allocating
  // a MediaRecorder pipeline while the user has requested lean mode.
  if (shouldDefer('voice-memory')) {
    if (statusEl) statusEl.textContent = t('voiceMemory.lowbwDisabled') || t('voiceMemory.record');
    return;
  }
  try {
    activeRecording = await startRecording(onTick, onComplete);
    setRecordingUi(true);
    statusEl.textContent = t('voiceMemory.recording');
  } catch (err) {
    console.warn('[voice-memory] start failed', err);
    const msg = err && err.message === 'permission-denied'
      ? t('voiceMemory.permissionDenied')
      : t('voiceMemory.notSupported');
    statusEl.textContent = msg;
  }
}

function onTick(elapsedSec) {
  const clamped = Math.min(elapsedSec, 30);
  const pct = clamped / 30;
  if (ringEl) {
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    ringEl.setAttribute('stroke-dashoffset', String(offset));
  }
  if (timerEl) timerEl.textContent = `${formatSec(clamped)} / 0:30`;
}

async function onComplete(blob, meta) {
  activeRecording = null;
  setRecordingUi(false);
  if (timerEl) timerEl.textContent = '0:00 / 0:30';
  if (ringEl) ringEl.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
  try {
    const saved = await saveMemory(blob);
    statusEl.textContent = saved ? t('voiceMemory.savedToday') : t('voiceMemory.record');
    if (saved) await refreshList();
  } catch (err) {
    console.error('[voice-memory] save failed', err);
    statusEl.textContent = t('voiceMemory.notSupported');
  }
}

function setRecordingUi(isRecording) {
  if (!recordBtn) return;
  recordBtn.classList.toggle('is-recording', isRecording);
  recordBtn.setAttribute('aria-pressed', isRecording ? 'true' : 'false');
  recordBtn.setAttribute('aria-label', isRecording ? t('voiceMemory.stop') : t('voiceMemory.record'));
}

function formatSec(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function refreshList() {
  if (!listEl) return;
  empty(listEl);
  const memories = await listMemories();
  if (!memories.length) {
    listEl.appendChild(h('li', { class: 'voice-memory-empty text-muted' }, t('voiceMemory.empty')));
    return;
  }
  for (const mem of memories) {
    const url = await getMemory(mem.date);
    const audio = h('audio', { controls: true, preload: 'metadata', src: url || '' });
    const delBtn = h('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      'aria-label': `${t('voiceMemory.delete')} ${mem.date}`
    }, t('voiceMemory.delete'));
    delBtn.addEventListener('click', async () => {
      if (!confirm(t('voiceMemory.deleteConfirm'))) return;
      if (url) URL.revokeObjectURL(url);
      await deleteMemory(mem.date);
      await refreshList();
    });
    listEl.appendChild(h('li', { class: 'voice-memory-item' }, [
      h('div', { class: 'voice-memory-item-head' }, [
        h('strong', null, mem.date),
        h('span', { class: 'text-muted small' }, `${(mem.size / 1024).toFixed(1)} KB`)
      ]),
      audio,
      h('div', { class: 'voice-memory-item-actions' }, [delBtn])
    ]));
  }
}
