// js/pages/fun.js
// Fun page: card grid → tap to expand into full sub-view.
// Cards: Bingo, Daily Dare, FutureMe, Soundtrack.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let activeCard = null; // null = grid view, card id = expanded
let unsubscribers = [];

const CARDS = [
  { id: 'bingo',      icon: '🎯', accentVar: '--fun-purple', labelKey: 'fun.card.bingo',     teaserKey: 'fun.teaser.bingo' },
  { id: 'dares',      icon: '⚡', accentVar: '--fun-orange', labelKey: 'fun.card.dares',     teaserKey: 'fun.teaser.dares' },
  { id: 'futureMe',   icon: '💌', accentVar: '--fun-teal',   labelKey: 'fun.card.futureMe',  teaserKey: 'fun.teaser.futureMe' },
  { id: 'soundtrack', icon: '🎵', accentVar: '--fun-pink',   labelKey: 'fun.card.soundtrack', teaserKey: 'fun.teaser.soundtrack' }
];

const subModules = {};

export async function mount(container) {
  containerEl = container;
  activeCard = null;
  render();

  unsubscribers.push(
    state.subscribe('bingo', render),
    state.subscribe('dares', render),
    state.subscribe('futureMessages', render),
    state.subscribe('language', render),
    state.subscribe('route', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  activeCard = null;
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  if (activeCard) {
    renderExpanded();
  } else {
    renderGrid();
  }
}

function renderGrid() {
  const grid = h('div', { class: 'fun-grid' });

  CARDS.forEach(card => {
    const teaser = getTeaser(card.id);
    const el = h('button', {
      class: 'fun-card',
      type: 'button',
      style: { '--card-accent': `var(${card.accentVar})` },
      onclick: () => { activeCard = card.id; render(); }
    }, [
      h('div', { class: 'fun-card-icon' }, card.icon),
      h('div', { class: 'fun-card-body' }, [
        h('h3', { class: 'fun-card-title' }, t(card.labelKey)),
        h('p', { class: 'fun-card-teaser' }, teaser)
      ])
    ]);
    grid.appendChild(el);
  });

  containerEl.appendChild(h('div', { class: 'fun-page' }, [
    h('h1', { class: 'page-title' }, t('fun.pageTitle')),
    grid
  ]));
}

async function renderExpanded() {
  const card = CARDS.find(c => c.id === activeCard);
  if (!card) { activeCard = null; render(); return; }

  const wrapper = h('div', { class: 'fun-expanded', style: { '--card-accent': `var(${card.accentVar})` } });

  // Back button
  wrapper.appendChild(h('button', {
    class: 'fun-back-btn',
    type: 'button',
    onclick: () => { activeCard = null; render(); }
  }, [h('span', null, '←'), h('span', null, t('fun.backToGrid'))]));

  // Header
  wrapper.appendChild(h('div', { class: 'fun-expanded-header' }, [
    h('span', { class: 'fun-expanded-icon' }, card.icon),
    h('h2', null, t(card.labelKey))
  ]));

  // Content area — lazy-load sub-module
  const contentArea = h('div', { class: 'fun-expanded-content' });
  wrapper.appendChild(contentArea);

  try {
    if (!subModules[activeCard]) {
      switch (activeCard) {
        case 'bingo':      subModules.bingo = await import('../ui/bingo-tab.js'); break;
        case 'dares':      subModules.dares = await import('../features/daily-dare.js'); break;
        case 'futureMe':   subModules.futureMe = await import('../features/future-me.js'); break;
        case 'soundtrack': subModules.soundtrack = await import('../features/soundtrack.js'); break;
      }
    }
    const mod = subModules[activeCard];
    if (mod?.renderInto) {
      await mod.renderInto(contentArea);
    } else {
      contentArea.textContent = t('fun.comingSoon');
    }
  } catch (err) {
    console.error(`[fun] failed to load ${activeCard}`, err);
    contentArea.textContent = t('fun.loadError');
  }

  containerEl.appendChild(wrapper);
}

function getTeaser(cardId) {
  switch (cardId) {
    case 'bingo': {
      const done = Object.keys(state.getSlice('bingo')?.completed || {}).length;
      return `${done}/25 ${t('fun.challenges')}`;
    }
    case 'dares': {
      const streak = state.getSlice('dares')?.streak || 0;
      return streak > 0 ? `${streak} ${t('fun.dayStreak')}` : t('fun.startDare');
    }
    case 'futureMe': {
      const count = (state.getSlice('futureMessages') || []).length;
      return count > 0 ? `${count} ${t('fun.capsules')}` : t('fun.writeCapsule');
    }
    case 'soundtrack':
      return t('fun.listenNow');
    default:
      return '';
  }
}
