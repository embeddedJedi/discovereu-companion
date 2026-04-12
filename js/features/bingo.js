// js/features/bingo.js
// City Bingo logic: card assembly, done tracking (localStorage), bingo
// line detection, and photo attachment (IndexedDB).
// Bingo UI lives in js/ui/bingo-tab.js — this file stays DOM-free.

import { state } from '../state.js';
import { loadBingoChallenges } from '../data/loader.js';
import { compressImage } from '../utils/image.js';
import { idbPut, idbGet, idbDelete } from '../utils/storage.js';

const PHOTO_STORE = 'bingoPhotos';

let _data = null;

export async function ensureBingoData() {
  if (_data) return _data;
  _data = await loadBingoChallenges();
  return _data;
}

/**
 * Build the active card for the user. The universal 25 are always the
 * same order (matching the JSON file order); bonuses come from any
 * country currently in state.route.stops.
 */
export function getActiveCard(route, bingoData) {
  const data = bingoData || _data;
  if (!data) return { universal: [], bonuses: [] };
  const stops = route?.stops || [];
  const countryIds = [...new Set(stops.map(s => s.countryId))];
  const bonuses = countryIds
    .flatMap(id => data.byCountry?.[id] || [])
    .slice(0, 10);
  return { universal: data.universal.slice(0, 25), bonuses };
}

export function isDone(challengeId) {
  return !!state.getSlice('bingo')?.completed?.[challengeId];
}

export function markDone(challengeId) {
  state.update('bingo', prev => ({
    ...prev,
    completed: { ...prev.completed, [challengeId]: true }
  }));
}

export function markUndone(challengeId) {
  state.update('bingo', prev => {
    const next = { ...prev.completed };
    delete next[challengeId];
    return { ...prev, completed: next };
  });
}

export function getProgress() {
  const done = state.getSlice('bingo')?.completed || {};
  const total = _data?.universal?.length || 25;
  const doneCount = Object.keys(done).filter(id => id.startsWith('uni-')).length;
  return { done: doneCount, total };
}

/**
 * Scan the 25 universal cells for completed rows / columns / diagonals.
 * Cells are laid out row-major, 5x5.
 */
export function detectBingoLines(universal, completedIds) {
  if (!Array.isArray(universal) || universal.length < 25) return [];
  const ids = universal.slice(0, 25).map(c => c.id);
  const cellDone = i => completedIds.has(ids[i]);
  const lines = [];
  for (let r = 0; r < 5; r++) {
    const idxs = [0,1,2,3,4].map(c => r * 5 + c);
    if (idxs.every(cellDone)) lines.push({ type: 'row', index: r, ids: idxs.map(i => ids[i]) });
  }
  for (let c = 0; c < 5; c++) {
    const idxs = [0,1,2,3,4].map(r => r * 5 + c);
    if (idxs.every(cellDone)) lines.push({ type: 'col', index: c, ids: idxs.map(i => ids[i]) });
  }
  const d1 = [0, 6, 12, 18, 24];
  const d2 = [4, 8, 12, 16, 20];
  if (d1.every(cellDone)) lines.push({ type: 'diag', index: 0, ids: d1.map(i => ids[i]) });
  if (d2.every(cellDone)) lines.push({ type: 'diag', index: 1, ids: d2.map(i => ids[i]) });
  return lines;
}

export async function attachPhoto(challengeId, file) {
  const blob = await compressImage(file);
  await idbPut(PHOTO_STORE, challengeId, blob);
  return blob;
}

export async function getPhoto(challengeId) {
  return idbGet(PHOTO_STORE, challengeId);
}

export async function removePhoto(challengeId) {
  return idbDelete(PHOTO_STORE, challengeId);
}
