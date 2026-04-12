// js/ui/bingo-tab.js
// 5x5 bingo grid + bonus strip + cell detail modal with photo upload.
// Called by js/ui/fun-tab.js when the user selects the Bingo sub-tab.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty } from '../utils/dom.js';
import { showToast } from './toast.js';
import {
  ensureBingoData, getActiveCard, isDone, markDone, markUndone,
  getProgress, detectBingoLines, attachPhoto, getPhoto, removePhoto,
  canGenerateCollage, generateCollage
} from '../features/bingo.js';

function useTr() { return state.getSlice('language') === 'tr'; }

export async function renderBingo(container) {
  empty(container);
  const loading = h('p', { class: 'text-muted', 'aria-busy': 'true' }, t('bingo.loading'));
  container.appendChild(loading);

  await ensureBingoData();
  empty(container);

  const card = getActiveCard(state.getSlice('route'));
  const { done, total } = getProgress();

  container.appendChild(h('header', { class: 'bingo-header' }, [
    h('h3', null, `🎯 ${t('bingo.title')}`),
    h('p', { class: 'bingo-progress' }, t('bingo.progress', { done, total }))
  ]));

  const grid = h('div', { class: 'bingo-grid', role: 'grid', 'aria-label': t('bingo.gridLabel') });
  card.universal.forEach((cell, i) => grid.appendChild(buildCell(cell, 'universal')));
  container.appendChild(grid);

  if (card.bonuses.length) {
    container.appendChild(h('h4', null, `⭐ ${t('bingo.bonusTitle')}`));
    const strip = h('div', { class: 'bingo-bonus-strip' });
    card.bonuses.forEach(b => strip.appendChild(buildCell(b, 'bonus')));
    container.appendChild(strip);
  }

  container.appendChild(h('p', { class: 'bingo-legend text-muted small' }, t('bingo.legend')));

  // Collage CTA — only surfaced when ≥4 photos are stored locally.
  try {
    if (await canGenerateCollage()) {
      const btn = h('button', {
        class: 'btn btn-primary bingo-collage-cta',
        type: 'button'
      }, `🖼️ ${t('bingo.collage.generate')}`);
      on(btn, 'click', () => openCollageModal());
      container.appendChild(btn);
    }
  } catch (e) { console.warn('[bingo-tab] collage availability check failed', e); }

  const completedIds = new Set(Object.keys(state.getSlice('bingo')?.completed || {}));
  const lines = detectBingoLines(card.universal, completedIds);
  if (lines.length) {
    container.appendChild(h('div', { class: 'bingo-celebrate' }, [
      h('strong', null, `🎉 ${t('bingo.lineBanner', { n: lines.length })}`)
    ]));
  }

  // Async: render any existing photos as thumbnails
  for (const cell of [...card.universal, ...card.bonuses]) {
    getPhoto(cell.id).then(blob => {
      if (!blob) return;
      const host = container.querySelector(`[data-cell-id="${cell.id}"] .bingo-cell-thumb`);
      if (!host) return;
      const url = URL.createObjectURL(blob);
      const img = h('img', { src: url, alt: '' });
      host.appendChild(img);
    });
  }
}

function buildCell(cell, type) {
  const title = useTr() ? cell.titleTr : cell.title;
  const done = isDone(cell.id);
  const btn = h('button', {
    class: `bingo-cell ${done ? 'is-done' : ''} bingo-cell-${type}`,
    type: 'button',
    role: 'gridcell',
    'aria-pressed': done ? 'true' : 'false',
    'data-cell-id': cell.id
  }, [
    h('div', { class: 'bingo-cell-emoji' }, cell.emoji || '⭐'),
    h('div', { class: 'bingo-cell-title' }, title),
    h('div', { class: 'bingo-cell-thumb' })
  ]);
  on(btn, 'click', () => openCellDetail(cell));
  return btn;
}

function openCellDetail(cell) {
  const title = useTr() ? cell.titleTr : cell.title;
  const hint  = useTr() ? cell.hintTr  : cell.hint;
  const done  = isDone(cell.id);

  const overlay = h('div', { class: 'modal-overlay bingo-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const body = h('div', { class: 'modal-body' }, [
    h('p', { class: 'bingo-hint' }, hint || ''),
    (() => {
      const input = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('bingo.uploadLabel') });
      on(input, 'change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          await attachPhoto(cell.id, file);
          showToast({ message: t('bingo.photoSaved'), variant: 'success' });
          close();
          rerenderParent();
        } catch (e) {
          showToast({ message: t('bingo.photoFailed'), variant: 'danger' });
        }
      });
      return input;
    })(),
    h('div', { class: 'modal-actions' }, [
      (() => {
        const b = h('button', { class: done ? 'btn btn-secondary' : 'btn btn-primary', type: 'button' },
          done ? t('bingo.markUndone') : t('bingo.markDone'));
        on(b, 'click', () => {
          if (done) markUndone(cell.id); else markDone(cell.id);
          close();
          rerenderParent();
        });
        return b;
      })(),
      (() => {
        const r = h('button', { class: 'btn btn-ghost', type: 'button' }, t('bingo.removePhoto'));
        on(r, 'click', async () => { await removePhoto(cell.id); close(); rerenderParent(); });
        return r;
      })()
    ])
  ]);

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `${cell.emoji || '⭐'} ${title}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    body
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);
}

async function openCollageModal() {
  const overlay = h('div', { class: 'modal-overlay bingo-modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('bingo.collage.title') });
  const previewHost = h('div', { class: 'bingo-collage-preview' }, [
    h('p', { class: 'text-muted', 'aria-busy': 'true' }, '…')
  ]);
  const actions = h('div', { class: 'modal-actions' });

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `🖼️ ${t('bingo.collage.title')}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    h('div', { class: 'modal-body' }, [previewHost, actions])
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  let objectUrl = null;
  let pngBlob = null;

  function close() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') trapFocus(e, card);
  }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);

  try {
    pngBlob = await generateCollage({ tr: useTr() });
    objectUrl = URL.createObjectURL(pngBlob);
    empty(previewHost);
    const img = h('img', {
      src: objectUrl,
      alt: t('bingo.collage.title'),
      class: 'bingo-collage-img',
      style: { maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '8px' }
    });
    previewHost.appendChild(img);

    const dl = h('button', { class: 'btn btn-primary', type: 'button' }, t('bingo.collage.download'));
    on(dl, 'click', () => downloadBlob(pngBlob));
    actions.appendChild(dl);

    if (navigator.canShare && navigator.share) {
      const sh = h('button', { class: 'btn btn-secondary', type: 'button' }, t('bingo.collage.share'));
      on(sh, 'click', () => sharePng(pngBlob));
      actions.appendChild(sh);
    }

    const closeBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, t('modal.close'));
    on(closeBtn, 'click', close);
    actions.appendChild(closeBtn);

    // Move focus to download for keyboard users
    dl.focus();
  } catch (e) {
    console.warn('[bingo-tab] collage generation failed', e);
    empty(previewHost);
    previewHost.appendChild(h('p', { class: 'text-muted' }, t('bingo.collage.needMorePhotos')));
    const closeBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, t('modal.close'));
    on(closeBtn, 'click', close);
    actions.appendChild(closeBtn);
  }
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `discovereu-bingo-collage-${today}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function sharePng(blob) {
  const file = new File([blob], 'discovereu-bingo-collage.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'DiscoverEU Bingo' });
      return;
    }
  } catch (e) { console.warn('[bingo-tab] share failed', e); }
  // Fallback: trigger download + toast
  downloadBlob(blob);
  showToast({ message: t('bingo.photoSaved'), variant: 'success' });
}

function trapFocus(ev, root) {
  const focusables = root.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (ev.shiftKey && document.activeElement === first) {
    last.focus(); ev.preventDefault();
  } else if (!ev.shiftKey && document.activeElement === last) {
    first.focus(); ev.preventDefault();
  }
}

function rerenderParent() {
  const host = document.querySelector('.fun-panel-bingo');
  if (host) renderBingo(host);
}

// Fun page card API — renders the full bingo module into any container.
export { renderBingo as renderInto };
