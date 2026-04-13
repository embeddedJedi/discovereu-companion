// js/features/wrapped.js
// DiscoverEU Wrapped v2 — Instagram-ready Post (1080×1350) and Story
// (1080×1920) export cards with a canvas-drawn mini route map, 5-stat
// grid and (Story only) a QR code linking back to the share URL.
//
// The card is rendered as DOM at its true export dimensions, then the
// viewport preview simply scales it down via a CSS transform. html2canvas
// flattens the real-size card so the output PNG is always platform-perfect.

/* global html2canvas */

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty } from '../utils/dom.js';
import { computeCO2 } from './co2.js';
import { computeSeatCredits } from './seat-credits.js';
import { currentShareURL } from '../utils/share.js';
import { showToast } from '../ui/toast.js';
import { shouldDefer } from './low-bw.js';

// ─── Export dimensions ──────────────────────────────────────────────────
const FORMATS = {
  post:  { w: 1080, h: 1350, mapH: 720, label: 'post'  },
  story: { w: 1080, h: 1920, mapH: 900, label: 'story' }
};

// Capital lat/lng — kept in sync with js/features/co2.js. Duplicated here
// rather than importing so the CO2 module stays a pure computation module
// (no UI coupling). If these drift, update both.
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

// Rough Europe bounding box used to project capital coordinates into
// canvas pixel-space. Slightly looser than Natural Earth's Europe extent
// so small-country dots don't hug the edge.
const BOUNDS = { west: -10, east: 45, south: 35, north: 70 };

// ─── Entry ──────────────────────────────────────────────────────────────

export function openWrapped() {
  const route = state.getSlice('route');
  if (!route?.stops?.length) {
    showToast(t('wrapped.empty'), 'warning');
    return;
  }

  const overlay = renderModal();
  document.body.appendChild(overlay);

  // Low-bandwidth gate — don't auto-render the canvas-heavy card. Show
  // a placeholder button inside the preview area; user clicks to opt
  // into the heavy render. Compare/radar charts and the static modal
  // chrome stay because they are essential, not decorative.
  if (shouldDefer('wrapped')) {
    const preview = overlay.querySelector('.wrapped-preview');
    if (preview) {
      empty(preview);
      const loadBtn = h('button', {
        type: 'button',
        class: 'lowbw-placeholder',
        style: 'display:block;'
      }, t('wrapped.lowbw.loadCard') || 'Click to load story card');
      loadBtn.addEventListener('click', () => {
        renderPreview(overlay, 'post');
      }, { once: true });
      preview.appendChild(loadBtn);
    }
  } else {
    // Initial render after insertion so canvas sizing is stable.
    renderPreview(overlay, 'post');
  }
  overlay.querySelector('.modal-close')?.focus();
}

function closeModal(overlay) {
  overlay.classList.add('closing');
  setTimeout(() => overlay.remove(), 200);
}

// ─── Modal shell ────────────────────────────────────────────────────────

function renderModal() {
  const overlay = h('div', { class: 'modal-overlay wrapped-v2-modal', 'data-modal': 'wrapped' });

  const modal = h('div', { class: 'modal modal-wrapped-v2', role: 'dialog', 'aria-modal': 'true' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', { class: 'modal-title' }, t('wrapped.title')),
      h('button', {
        class: 'modal-close',
        type: 'button',
        'aria-label': t('modal.close'),
        'data-action': 'close-modal'
      }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      h('div', { class: 'wrapped-v2-format-toggle', role: 'tablist', 'aria-label': t('wrapped.title') }, [
        h('button', {
          class: 'wrapped-v2-toggle-btn active',
          type: 'button',
          role: 'tab',
          'aria-selected': 'true',
          'data-format': 'post'
        }, t('wrapped.formatPost')),
        h('button', {
          class: 'wrapped-v2-toggle-btn',
          type: 'button',
          role: 'tab',
          'aria-selected': 'false',
          'data-format': 'story'
        }, t('wrapped.formatStory'))
      ]),
      h('div', { class: 'wrapped-v2-preview-shell' })
    ]),
    h('footer', { class: 'modal-footer' }, [
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        'data-action': 'close-modal'
      }, t('modal.cancel')),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        'data-action': 'download-wrapped'
      }, t('wrapped.download'))
    ])
  ]);

  overlay.appendChild(modal);

  on(overlay, 'click', (ev) => { if (ev.target === overlay) closeModal(overlay); });
  on(overlay, 'click', '[data-action="close-modal"]', () => closeModal(overlay));
  on(overlay, 'click', '[data-format]', (ev, target) => {
    const fmt = target.dataset.format;
    overlay.querySelectorAll('.wrapped-v2-toggle-btn').forEach(btn => {
      const active = btn.dataset.format === fmt;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    renderPreview(overlay, fmt);
  });
  on(overlay, 'click', '[data-action="download-wrapped"]', () => {
    const card = overlay.querySelector('.wrapped-v2-card');
    if (card) downloadCard(card);
  });

  const escHandler = (ev) => {
    if (ev.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return overlay;
}

// ─── Preview render ─────────────────────────────────────────────────────

function renderPreview(overlay, format) {
  const shell = overlay.querySelector('.wrapped-v2-preview-shell');
  if (!shell) return;
  empty(shell);
  const card = renderCard(format);
  shell.appendChild(card);
  // Draw the canvas after the card is attached so its layout size is final.
  requestAnimationFrame(() => {
    const canvas = card.querySelector('canvas.wrapped-v2-map');
    if (canvas) drawMiniMap(canvas, state.getSlice('route'));
  });
}

// ─── Card DOM (at true export pixel dimensions) ─────────────────────────

function renderCard(format) {
  const fmt = FORMATS[format] || FORMATS.post;
  const route = state.getSlice('route');
  const stats = computeWrappedStats(route);
  const name = route?.name || t('wrapped.defaultName');
  const shareURL = format === 'story' ? currentShareURL(route) : '';

  const card = h('div', {
    class: 'wrapped-v2-card',
    'data-wrapped-card': 'true',
    'data-format': fmt.label,
    style: {
      '--card-w': `${fmt.w}px`,
      '--card-h': `${fmt.h}px`,
      '--map-h':  `${fmt.mapH}px`
    }
  }, [
    h('div', { class: 'wrapped-v2-header' }, [
      h('div', { class: 'wrapped-v2-brand' }, [
        h('span', { class: 'wrapped-v2-star' }, '★'),
        h('div', null, [
          h('strong', null, 'DiscoverEU'),
          h('span', null, t('wrapped.footerTag'))
        ])
      ]),
      h('div', { class: 'wrapped-v2-eyebrow' }, t('wrapped.shareTagline'))
    ]),

    h('h1', { class: 'wrapped-v2-title' }, name),

    // Mini map
    h('div', { class: 'wrapped-v2-map-wrap' }, [
      h('canvas', {
        class: 'wrapped-v2-map',
        width: fmt.w - 120,
        height: fmt.mapH
      })
    ]),

    // Stats — 5 cells
    h('div', { class: 'wrapped-v2-stats' }, [
      renderStat(stats.countries,    t('wrapped.statCountries')),
      renderStat(stats.totalKm,      t('wrapped.statKm')),
      renderStat(stats.days,         t('wrapped.statDays')),
      renderStat(stats.co2SavedKg,   t('wrapped.statCo2'),     'kg'),
      renderStat(
        `${stats.creditsUsed}/${stats.creditsLimit}`,
        t('wrapped.statCredits')
      )
    ]),

    // Footer — QR only in story
    h('div', { class: 'wrapped-v2-footer' }, [
      format === 'story' && shareURL
        ? h('div', { class: 'wrapped-v2-qr' }, [
            h('img', {
              src: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareURL)}&size=240x240&bgcolor=0a0e27&color=FFCC00`,
              alt: 'QR code',
              width: 240,
              height: 240,
              crossorigin: 'anonymous'
            }),
            h('span', { class: 'wrapped-v2-qr-label' }, t('wrapped.scanToOpen'))
          ])
        : null,
      h('div', { class: 'wrapped-v2-watermark' }, [
        h('div', { class: 'wrapped-v2-motto' }, 'Engage · Connect · Empower'),
        h('div', { class: 'wrapped-v2-url' }, 'discovereu-companion')
      ])
    ])
  ]);

  return card;
}

function renderStat(value, label, unit) {
  return h('div', { class: 'wrapped-v2-stat' }, [
    h('div', { class: 'wrapped-v2-stat-value' }, [
      String(value),
      unit ? h('span', { class: 'wrapped-v2-stat-unit' }, unit) : null
    ]),
    h('div', { class: 'wrapped-v2-stat-label' }, label)
  ]);
}

// ─── Stats ──────────────────────────────────────────────────────────────

function computeWrappedStats(route) {
  const stops = route?.stops || [];
  const countries = stops.map(s => countryById(s.countryId)).filter(Boolean);
  const uniqueCountries = new Set(countries.map(c => c.id)).size;

  const co2 = computeCO2(route);
  const credits = computeSeatCredits(route);
  const days = stops.reduce((n, s) => n + (Number(s.nights) || 0), 0);

  return {
    countries:    uniqueCountries,
    totalKm:      co2.totalKm,
    days,
    co2SavedKg:   co2.savedKg,
    creditsUsed:  credits.used,
    creditsLimit: credits.limit
  };
}

// ─── Canvas mini map ────────────────────────────────────────────────────

function drawMiniMap(canvas, route) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const hgt = canvas.height;

  ctx.clearRect(0, 0, w, hgt);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(0, 0, w, hgt);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, w - 16, hgt - 16);

  // Light grid so the shape reads as "a map"
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (hgt / 6) * i;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(w - 8, y);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const x = (w / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, hgt - 8);
    ctx.stroke();
  }

  // Faint dots for every DiscoverEU country, so the shape of Europe is
  // readable even if a route has just one stop.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  for (const [, [lat, lng]] of Object.entries(CAPITAL_LATLNG)) {
    const [x, y] = project(lat, lng, w, hgt);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Route polyline + dots
  const stops = (route?.stops || [])
    .map(s => CAPITAL_LATLNG[s.countryId])
    .filter(Boolean)
    .map(([lat, lng]) => project(lat, lng, w, hgt));

  if (stops.length >= 2) {
    ctx.strokeStyle = '#FFCC00';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255, 204, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(stops[0][0], stops[0][1]);
    for (let i = 1; i < stops.length; i++) ctx.lineTo(stops[i][0], stops[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  stops.forEach(([x, y], i) => {
    ctx.fillStyle = '#FFCC00';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0e27';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    if (i === 0 || i === stops.length - 1) {
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function project(lat, lng, w, hgt) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * w;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * hgt;
  return [x, y];
}

// ─── Export ─────────────────────────────────────────────────────────────

async function downloadCard(cardEl) {
  if (!cardEl) return;
  if (typeof html2canvas === 'undefined') {
    showToast(t('wrapped.libMissing'), 'danger');
    return;
  }

  const format = cardEl.dataset.format || 'post';
  const fmt = FORMATS[format] || FORMATS.post;
  const date = new Date().toISOString().slice(0, 10);

  try {
    const canvas = await html2canvas(cardEl, {
      backgroundColor: null,
      scale: window.devicePixelRatio || 2,
      width: fmt.w,
      height: fmt.h,
      windowWidth: fmt.w,
      windowHeight: fmt.h,
      useCORS: true,
      allowTaint: false,
      logging: false
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovereu-wrapped-${format}-${date}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(t('wrapped.downloaded'), 'success');
  } catch (err) {
    console.warn('[wrapped] export failed', err);
    showToast(t('wrapped.exportFailed'), 'danger');
  }
}

/**
 * Attach the Wrapped trigger to any element with `data-wrapped-trigger`.
 * Called once from main.js during boot. Signature preserved for back-compat.
 */
export function initWrappedTrigger() {
  document.addEventListener('click', (ev) => {
    const trigger = ev.target.closest?.('[data-wrapped-trigger]');
    if (trigger) {
      ev.preventDefault();
      openWrapped();
    }
  });
}
