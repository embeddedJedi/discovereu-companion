// js/features/wrapped.js
// DiscoverEU Wrapped — a square, Instagram-ready card summarising the
// user's planned trip (countries, distance, CO₂ saved, nights, seat
// credits). Rendered as real DOM so every pixel is legible by
// screen-readers and inspectable by EACEA reviewers, then flattened to
// a PNG through html2canvas for sharing.
//
// The card is drawn at 1080 × 1080 regardless of device size so the
// exported image is always platform-perfect.

/* global html2canvas */

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, qs, empty, on } from '../utils/dom.js';
import { computeCO2 } from './co2.js';
import { computeSeatCredits } from './seat-credits.js';
import { showToast } from '../ui/toast.js';

const CARD_SIZE = 1080;

/**
 * Open the Wrapped modal. If the route is empty we show a gentle nudge
 * instead of an empty card.
 */
export function openWrapped() {
  const route = state.getSlice('route');
  if (!route?.stops?.length) {
    showToast(t('wrapped.empty'), 'warning');
    return;
  }

  const overlay = renderModal();
  document.body.appendChild(overlay);

  // Focus the close button so Esc / Tab navigation works immediately.
  overlay.querySelector('.modal-close')?.focus();
}

function closeModal(overlay) {
  overlay.classList.add('closing');
  setTimeout(() => overlay.remove(), 200);
}

// ─── Modal shell ─────────────────────────────────────────────────────────

function renderModal() {
  const overlay = h('div', { class: 'modal-overlay', 'data-modal': 'wrapped' });

  const modal = h('div', { class: 'modal modal-wrapped', role: 'dialog', 'aria-modal': 'true' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', { class: 'modal-title' }, t('wrapped.modalTitle')),
      h('button', {
        class: 'modal-close',
        type: 'button',
        'aria-label': t('modal.close'),
        'data-action': 'close-modal'
      }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      renderCard(),
      h('p', { class: 'wrapped-hint' }, t('wrapped.hint'))
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

  // Click outside the modal closes it.
  on(overlay, 'click', (ev) => {
    if (ev.target === overlay) closeModal(overlay);
  });
  on(overlay, 'click', '[data-action="close-modal"]', () => closeModal(overlay));
  on(overlay, 'click', '[data-action="download-wrapped"]', () => {
    downloadCard(overlay.querySelector('.wrapped-card'));
  });
  document.addEventListener('keydown', function escHandler(ev) {
    if (ev.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  });

  return overlay;
}

// ─── The card itself ─────────────────────────────────────────────────────

function renderCard() {
  const route = state.getSlice('route');
  const stops = route?.stops || [];
  const countries = stops.map(s => countryById(s.countryId)).filter(Boolean);
  const uniqueCountries = [...new Set(countries.map(c => c.id))];

  const co2 = computeCO2(route);
  const credits = computeSeatCredits(route);
  const totalNights = stops.reduce((n, s) => n + (Number(s.nights) || 0), 0);

  const flagStrip = countries.map(c => c.flag || '').join(' ');

  return h('div', { class: 'wrapped-card', 'data-wrapped-card': 'true' }, [
    // Header band
    h('div', { class: 'wrapped-band' }, [
      h('span', { class: 'wrapped-star' }, '★'),
      h('div', { class: 'wrapped-brand' }, [
        h('strong', null, 'DiscoverEU'),
        h('span', null, t('wrapped.tag'))
      ])
    ]),

    // Title
    h('div', { class: 'wrapped-title' }, [
      h('div', { class: 'wrapped-eyebrow' }, t('wrapped.eyebrow')),
      h('h1', { class: 'wrapped-heading' },
        route.name || t('wrapped.defaultName'))
    ]),

    // Flag strip
    h('div', { class: 'wrapped-flags', 'aria-label': 'Countries visited' }, flagStrip),

    // Big stats grid — 4 cells
    h('div', { class: 'wrapped-stats' }, [
      renderStat(uniqueCountries.length, t('wrapped.stat.countries')),
      renderStat(totalNights,             t('wrapped.stat.nights')),
      renderStat(`${co2.totalKm}`,        t('wrapped.stat.km')),
      renderStat(`-${co2.savedKg}kg`,     t('wrapped.stat.co2'))
    ]),

    // Highlights row
    h('div', { class: 'wrapped-highlights' }, [
      credits.used > 0
        ? h('div', { class: 'wrapped-highlight' }, [
            h('span', { class: 'wrapped-highlight-icon' }, '🎫'),
            h('span', null, t('wrapped.highlight.credits',
              { used: credits.used, limit: credits.limit }))
          ])
        : null,
      co2.green
        ? h('div', { class: 'wrapped-highlight wrapped-highlight-green' }, [
            h('span', { class: 'wrapped-highlight-icon' }, '🌱'),
            h('span', null, t('wrapped.highlight.green', { pct: co2.savedPct }))
          ])
        : null
    ]),

    // Footer band
    h('div', { class: 'wrapped-footer' }, [
      h('span', null, 'Engage · Connect · Empower'),
      h('span', { class: 'wrapped-url' }, 'discovereu-companion')
    ])
  ]);
}

function renderStat(value, label) {
  return h('div', { class: 'wrapped-stat' }, [
    h('div', { class: 'wrapped-stat-value' }, String(value)),
    h('div', { class: 'wrapped-stat-label' }, label)
  ]);
}

// ─── Export → PNG ────────────────────────────────────────────────────────

async function downloadCard(cardEl) {
  if (!cardEl) return;
  if (typeof html2canvas === 'undefined') {
    showToast(t('wrapped.libMissing'), 'danger');
    return;
  }

  try {
    const canvas = await html2canvas(cardEl, {
      backgroundColor: null,
      scale: CARD_SIZE / cardEl.offsetWidth,
      useCORS: true,
      logging: false
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'discovereu-wrapped.png';
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
 * Attach the Wrapped trigger to a share menu button or any element with
 * `data-wrapped-trigger`. Called once from main.js during boot.
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
