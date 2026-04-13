// js/features/impact-card.js
// v1.4 Impact Dashboard — Strava-style canvas export card.
//
// Consumes the snapshot shape produced by impact-compute.js (flat
// `personal.*`) and renders a share-ready Instagram Post (1080x1080) or
// Story (1080x1920) PNG. No DOM mutation outside the caller-provided
// canvas; `exportImpactCard` creates its own offscreen canvas and returns
// a Blob — UI layer decides what to do with it.
//
// Reuses the map-projection approach from wrapped.js (BOUNDS + project()).
// TODO: extract `project()` + CAPITAL_LATLNG into utils/geo.js once a
// third consumer lands (wrapped.js, impact-compute.js, this module).

import { state } from '../state.js';
import { computeImpact } from './impact-compute.js';
import { getEffectiveLegs } from './effective-legs.js';

// ─── Formats ────────────────────────────────────────────────────────────
const FORMATS = {
  post:  { w: 1080, h: 1080, bigNum: 128, label: 'post'  },
  story: { w: 1080, h: 1920, bigNum: 160, label: 'story' }
};

// Capital lat/lng — mirrored from wrapped.js / co2.js. Keep in sync.
const CAPITAL_LATLNG = {
  AL: [41.33,  19.82], AT: [48.21,  16.37], BA: [43.87,  18.42], BE: [50.85,   4.35],
  BG: [42.70,  23.32], CH: [46.95,   7.45], CY: [35.17,  33.37], CZ: [50.08,  14.43],
  DE: [52.52,  13.40], DK: [55.68,  12.57], EE: [59.44,  24.75], ES: [40.42,  -3.70],
  FI: [60.17,  24.94], FR: [48.85,   2.35], GR: [37.98,  23.73], HR: [45.81,  15.98],
  HU: [47.50,  19.04], IE: [53.35,  -6.26], IS: [64.14, -21.94], IT: [41.90,  12.48],
  LI: [47.14,   9.52], LT: [54.69,  25.28], LU: [49.61,   6.13], LV: [56.95,  24.11],
  MK: [41.99,  21.43], MT: [35.90,  14.51], NL: [52.37,   4.89], NO: [59.91,  10.75],
  PL: [52.23,  21.01], PT: [38.72,  -9.14], RO: [44.43,  26.10], RS: [44.79,  20.45],
  SE: [59.33,  18.07], SI: [46.06,  14.51], SK: [48.15,  17.11], TR: [41.01,  28.98]
};
const BOUNDS = { west: -10, east: 45, south: 35, north: 70 };

// Country IDs in route.stops are lowercase ('de'); CAPITAL_LATLNG is
// uppercase. Normalise on lookup.
function capitalOf(countryId) {
  if (!countryId) return null;
  return CAPITAL_LATLNG[String(countryId).toUpperCase()] || null;
}

// Read a CSS custom property from :root with a hardcoded fallback.
// getComputedStyle is called once per export, not per draw call.
function readAccent() {
  let accent = '#003399';  // EU blue fallback
  let accent2 = '#FFCC00'; // EU gold fallback
  try {
    const cs = getComputedStyle(document.documentElement);
    const a1 = cs.getPropertyValue('--accent-primary').trim();
    const a2 = cs.getPropertyValue('--accent-gold').trim();
    if (a1) accent  = a1;
    if (a2) accent2 = a2;
  } catch (_) { /* non-DOM contexts */ }
  return { accent, accent2 };
}

/**
 * Pure render: draw an impact card onto the given canvas.
 * Caller owns canvas dimensions — this function reads `canvas.width/height`
 * and picks the matching format (post if square-ish, story if tall).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{personal: object, meta: object}} snapshot
 * @param {{route?: object, tripName?: string}} [opts]
 */
export function renderImpactCardToCanvas(canvas, snapshot, opts = {}) {
  if (!canvas || !snapshot?.personal) {
    throw new Error('[impact-card] canvas + snapshot.personal required');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[impact-card] 2D context unavailable');

  const W = canvas.width;
  const H = canvas.height;
  const isStory = H > W * 1.3;
  const fmt = isStory ? FORMATS.story : FORMATS.post;
  const p = snapshot.personal;

  const route = opts.route || state.get()?.route || { stops: [], returnStops: [] };
  const tripName = opts.tripName
    || route?.name
    || 'My DiscoverEU trip';

  const { accent, accent2 } = readAccent();

  // ── Background gradient ──────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, accent2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle dark vignette for text contrast.
  const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const FONT = '"Inter", -apple-system, "Segoe UI", system-ui, sans-serif';

  // ── Region layout (percent-based so post + story both work) ─────────
  const heroH   = Math.round(H * 0.15);
  const footerH = Math.round(H * 0.15);
  const midH    = H - heroH - footerH;      // ~70% of height
  const statsH  = Math.round(midH * 0.60);  // ~42% of H
  const mapY    = heroH + statsH;
  const mapH    = midH - statsH;            // ~28% of H

  // ── Hero banner ──────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('★ DiscoverEU Companion', 64, 72);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isStory ? 72 : 56}px ${FONT}`;
  const titleY = isStory ? 150 : 128;
  drawClippedText(ctx, tripName, 64, titleY, W - 128);

  const dates = formatDateRange(route);
  if (dates) {
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText(dates, 64, titleY + 40);
  }

  // ── Center 2x2 stat grid ─────────────────────────────────────────────
  const tiles = [
    { value: String(p.countriesVisited || 0),        label: 'Countries' },
    { value: formatNumber(p.totalKm || 0),           label: 'km travelled' },
    { value: formatNumber(Math.round(p.co2Saved || 0)), label: 'kg CO₂ saved' },
    { value: `€${formatNumber(p.estimatedLocalSpend || 0)}`, label: 'local spend' }
  ];

  const gridPadX = 64;
  const gridGap = 32;
  const tileW = (W - gridPadX * 2 - gridGap) / 2;
  const tileH = (statsH - gridGap) / 2 - 16;
  const gridTop = heroH + 16;

  tiles.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridPadX + col * (tileW + gridGap);
    const y = gridTop + row * (tileH + gridGap);
    drawTile(ctx, x, y, tileW, tileH, tile, fmt.bigNum, FONT);
  });

  // ── Mini-map strip ───────────────────────────────────────────────────
  drawMiniMap(ctx, 64, mapY + 8, W - 128, mapH - 16, route, accent2);

  // ── Footer: tagline + priority glyphs ────────────────────────────────
  const footerY = H - footerH;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, footerY, W, footerH);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left';
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('Powered by DiscoverEU Companion', 64, footerY + 60);

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText('Engage · Connect · Empower', 64, footerY + 92);

  drawPriorityGlyphs(ctx, p, W - 64, footerY + footerH / 2, FONT);

  // Alt-text for screen readers (Task 4 panel copy-button reads this).
  canvas.dataset.alt = buildAltText(p, tripName);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', canvas.dataset.alt);
}

// ─── Tile helper ────────────────────────────────────────────────────────
function drawTile(ctx, x, y, w, h, tile, bigNumPx, FONT) {
  // Glass-ish tile
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundedRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, w, h, 24);
  ctx.stroke();

  // Value
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Auto-shrink if value string doesn't fit at the default size.
  let size = bigNumPx;
  ctx.font = `800 ${size}px ${FONT}`;
  while (ctx.measureText(tile.value).width > w - 32 && size > 48) {
    size -= 8;
    ctx.font = `800 ${size}px ${FONT}`;
  }
  ctx.fillText(tile.value, x + w / 2, y + h / 2 - 8);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.80)';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(tile.label, x + w / 2, y + h / 2 + size / 2 + 8);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawClippedText(ctx, text, x, y, maxW) {
  // Crude ellipsis — canvas has no native text truncation.
  let str = String(text);
  if (ctx.measureText(str).width <= maxW) {
    ctx.fillText(str, x, y);
    return;
  }
  while (str.length > 0 && ctx.measureText(str + '…').width > maxW) {
    str = str.slice(0, -1);
  }
  ctx.fillText(str + '…', x, y);
}

// ─── Mini map ───────────────────────────────────────────────────────────
function drawMiniMap(ctx, x, y, w, h, route, accentGold) {
  // Neutral gray backdrop (no base tiles in canvas export).
  ctx.save();
  roundedRect(ctx, x, y, w, h, 18);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, h);

  // Faint capital dots so shape of Europe is readable.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (const [, [lat, lng]] of Object.entries(CAPITAL_LATLNG)) {
    const [px, py] = project(lat, lng, x, y, w, h);
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const stops = route?.stops || [];
  const returnStops = route?.returnStops || [];

  const outboundPts = stops.map(s => capitalOf(s.countryId))
    .filter(Boolean)
    .map(([lat, lng]) => project(lat, lng, x, y, w, h));

  // Return path: if explicit returnStops exist, use them; otherwise honour
  // the "include return in budget" toggle via getEffectiveLegs and show any
  // segment past the outbound stops as the return leg.
  let returnPts = returnStops.map(s => capitalOf(s.countryId))
    .filter(Boolean)
    .map(([lat, lng]) => project(lat, lng, x, y, w, h));
  if (returnPts.length === 0) {
    const legs = getEffectiveLegs(route || {});
    if (legs.length > stops.length) {
      returnPts = legs.slice(stops.length - 1)
        .map(s => capitalOf(s.countryId))
        .filter(Boolean)
        .map(([lat, lng]) => project(lat, lng, x, y, w, h));
    }
  }

  // Outbound — solid
  if (outboundPts.length >= 2) {
    ctx.strokeStyle = accentGold || '#FFCC00';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(outboundPts[0][0], outboundPts[0][1]);
    for (let i = 1; i < outboundPts.length; i++) {
      ctx.lineTo(outboundPts[i][0], outboundPts[i][1]);
    }
    ctx.stroke();
  }

  // Return — dashed
  if (returnPts.length >= 2) {
    ctx.strokeStyle = accentGold || '#FFCC00';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(returnPts[0][0], returnPts[0][1]);
    for (let i = 1; i < returnPts.length; i++) {
      ctx.lineTo(returnPts[i][0], returnPts[i][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Stop dots
  const drawDot = (px, py) => {
    ctx.fillStyle = accentGold || '#FFCC00';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  outboundPts.forEach(([px, py]) => drawDot(px, py));
  returnPts.forEach(([px, py]) => drawDot(px, py));

  ctx.restore();
}

function project(lat, lng, x, y, w, h) {
  const px = x + ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * w;
  const py = y + ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * h;
  return [px, py];
}

// ─── Priority glyphs (spec §10) ────────────────────────────────────────
// Decide which KA priorities the trip hits. Default `inclusion` to false
// until a11y counters land (see impact-compute.js TODO). Emoji render via
// the system emoji font — no CDN glyph pack.
function drawPriorityGlyphs(ctx, personal, rightX, cy, FONT) {
  const glyphs = [
    { on: (personal.co2Saved || 0) > 10,             ch: '🌱', label: 'green' },
    { on: (personal.a11yFeaturesUsed || []).length > 0, ch: '♿', label: 'inclusion' },
    { on: (personal.countriesVisited || 0) > 0,      ch: '🌍', label: 'participation' },
    { on: (personal.bingoCompleted || 0) > 2,        ch: '🗳️', label: 'digital' }
  ];

  ctx.font = `400 48px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // Draw right-to-left so the rightmost slot is glyph #0.
  let cursor = rightX;
  for (let i = glyphs.length - 1; i >= 0; i--) {
    const g = glyphs[i];
    ctx.globalAlpha = g.on ? 1.0 : 0.25;
    ctx.fillText(g.ch, cursor, cy);
    cursor -= 64;
  }
  ctx.globalAlpha = 1.0;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ─── Helpers ────────────────────────────────────────────────────────────
function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

function formatDateRange(route) {
  const start = route?.startDate;
  const end   = route?.endDate;
  if (!start && !end) return '';
  if (start && end) return `${start} → ${end}`;
  return start || end || '';
}

function buildAltText(p, tripName) {
  const parts = [
    `Impact card for ${tripName}.`,
    `${p.countriesVisited || 0} countries visited,`,
    `${formatNumber(p.totalKm || 0)} km travelled,`,
    `${formatNumber(Math.round(p.co2Saved || 0))} kg of CO2 saved,`,
    `€${formatNumber(p.estimatedLocalSpend || 0)} estimated local spend.`
  ];
  return parts.join(' ');
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Render an impact card and return a PNG Blob. Caller decides whether to
 * download, upload, or show a preview.
 *
 * @param {{format?: 'png', size?: 'post'|'story', snapshot?: object}} [opts]
 * @returns {Promise<Blob>}
 */
export async function exportImpactCard(opts = {}) {
  const size = opts.size === 'story' ? 'story' : 'post';
  const fmt = FORMATS[size];

  const snapshot = opts.snapshot || await computeImpact();

  const canvas = document.createElement('canvas');
  canvas.width  = fmt.w;
  canvas.height = fmt.h;
  renderImpactCardToCanvas(canvas, snapshot);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('[impact-card] toBlob returned null'));
      else resolve(blob);
    }, 'image/png');
  });
}
