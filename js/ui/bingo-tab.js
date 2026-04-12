// js/ui/bingo-tab.js
// 5x5 bingo grid + bonus strip + cell detail modal with photo upload.
// Called by js/ui/fun-tab.js when the user selects the Bingo sub-tab.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty } from '../utils/dom.js';
import { showToast } from './toast.js';
import {
  ensureBingoData, getActiveCard, isDone, markDone, markUndone,
  getProgress, detectBingoLines, attachPhoto, getPhoto, removePhoto
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

function rerenderParent() {
  const host = document.querySelector('.fun-panel-bingo');
  if (host) renderBingo(host);
}
