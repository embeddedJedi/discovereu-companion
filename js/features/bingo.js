// js/features/bingo.js
// City Bingo logic: card assembly, done tracking (localStorage), bingo
// line detection, and photo attachment (IndexedDB).
// Bingo UI lives in js/ui/bingo-tab.js — this file stays DOM-free.

import { state } from '../state.js';
import { loadBingoChallenges } from '../data/loader.js';
import { compressImage } from '../utils/image.js';
import { idbPut, idbGet, idbDelete, idbGetAll } from '../utils/storage.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// Collage generator (Canvas 2D, 1080x1080 PNG)
// ─────────────────────────────────────────────────────────────────────────────

/** Return an array of { key, value: Blob } pairs for all stored bingo photos. */
async function getAllPhotos() {
  const entries = await idbGetAll(PHOTO_STORE);
  return entries.filter(e => e.value instanceof Blob);
}

/** Returns true when we have at least 4 photos (minimum for a 2x2 collage). */
export async function canGenerateCollage() {
  const photos = await getAllPhotos();
  return photos.length >= 4;
}

function pickGridSize(n) {
  if (n >= 10) return 4;
  if (n >= 5)  return 3;
  return 2;
}

function findLabelForId(id, useTr) {
  if (!_data) return id;
  const all = [
    ..._data.universal || [],
    ...Object.values(_data.byCountry || {}).flat()
  ];
  const hit = all.find(c => c.id === id);
  if (!hit) return id;
  return (useTr ? hit.titleTr : hit.title) || hit.title || id;
}

/** Wrap a single line of text into multiple lines that fit within maxWidth. */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const w of words) {
    const probe = current ? current + ' ' + w : w;
    if (ctx.measureText(probe).width <= maxWidth) {
      current = probe;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // Truncate last line with ellipsis if we ran out of space
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + (words.length > lines.join(' ').split(/\s+/).length ? '…' : '');
  }
  return lines;
}

/** Draw one photo cell: cover-fit image, bottom gradient, challenge label. */
function drawCell(ctx, bitmap, label, x, y, size) {
  // Clip rounded rectangle for the cell
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  // Fallback background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, size, size);

  if (bitmap) {
    // Cover-fit: scale so the image fills the square, crop the overflow
    const br = bitmap.width / bitmap.height;
    let sw, sh, sx, sy;
    if (br > 1) {
      // landscape — crop sides
      sh = bitmap.height;
      sw = bitmap.height;
      sx = (bitmap.width - sw) / 2;
      sy = 0;
    } else {
      sw = bitmap.width;
      sh = bitmap.width;
      sx = 0;
      sy = (bitmap.height - sh) / 2;
    }
    ctx.drawImage(bitmap, sx, sy, sw, sh, x, y, size, size);
  }

  // Bottom gradient for legibility
  const gradH = Math.round(size * 0.3);
  const grad = ctx.createLinearGradient(0, y + size - gradH, 0, y + size);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y + size - gradH, size, gradH);

  // Label
  const fontPx = Math.max(14, Math.round(size * 0.075));
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const padX = Math.round(size * 0.08);
  const lines = wrapLines(ctx, label || '', size - padX * 2, 2);
  const lineH = Math.round(fontPx * 1.2);
  const startY = y + size - Math.round(size * 0.06) - (lines.length - 1) * lineH;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, startY + i * lineH);
  }

  ctx.restore();
}

function drawHeader(ctx, W, headerH) {
  // EU blue background band
  ctx.fillStyle = '#003399';
  ctx.fillRect(0, 0, W, headerH);

  // Gold star mark
  const cy = headerH / 2;
  const cx = 40;
  ctx.fillStyle = '#FFCC00';
  ctx.beginPath();
  const spikes = 5;
  const outerR = 20;
  const innerR = 8;
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(rot) * r;
    const py = cy + Math.sin(rot) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();

  // Title text in white
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('DiscoverEU Companion — My Bingo', 80, cy);
}

/**
 * Generate a 1080x1080 PNG collage from stored bingo photos.
 * Layout: 2x2 (4), 3x3 (5-9), 4x4 (10-16). Extra photos beyond 16 are ignored.
 *
 * @param {Object} [options]
 * @param {boolean} [options.tr]  Use Turkish labels when true.
 * @returns {Promise<Blob>} PNG blob, 1080x1080.
 */
export async function generateCollage(options = {}) {
  await ensureBingoData();
  const useTr = !!options.tr;

  const photos = await getAllPhotos();
  if (photos.length < 4) {
    throw new Error('[bingo.collage] need at least 4 photos');
  }

  const W = 1080;
  const H = 1080;
  const headerH = 80;
  const padding = 24;
  const gap = 12;

  const grid = pickGridSize(photos.length);
  const maxCells = grid * grid;
  const used = photos.slice(0, maxCells);

  // Decode blobs → ImageBitmaps in parallel
  const bitmaps = await Promise.all(used.map(async p => {
    try { return await createImageBitmap(p.value); }
    catch (e) { console.warn('[bingo.collage] decode failed for', p.key, e); return null; }
  }));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0b0d17';
  ctx.fillRect(0, 0, W, H);

  // Header band
  drawHeader(ctx, W, headerH);

  // Grid area
  const gridTop = headerH + padding;
  const gridSize = W - padding * 2;
  const cellSize = Math.floor((gridSize - gap * (grid - 1)) / grid);

  // Re-center vertically within remaining area
  const gridH = cellSize * grid + gap * (grid - 1);
  const vOffset = Math.max(0, Math.floor((H - headerH - gridH) / 2) - padding);
  const gridStartY = gridTop + vOffset;

  for (let i = 0; i < maxCells; i++) {
    const row = Math.floor(i / grid);
    const col = i % grid;
    const x = padding + col * (cellSize + gap);
    const y = gridStartY + row * (cellSize + gap);

    const photo = used[i];
    const bm = bitmaps[i];
    if (photo && bm) {
      const label = findLabelForId(photo.key, useTr);
      drawCell(ctx, bm, label, x, y, cellSize);
    } else {
      // Empty slot (shouldn't happen when n >= grid^2, but used for padding)
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }

  // Release decoded bitmaps
  bitmaps.forEach(b => { try { b && b.close && b.close(); } catch (e) { /* ignore */ } });

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('[bingo.collage] canvas.toBlob returned null'));
    }, 'image/png');
  });
}
