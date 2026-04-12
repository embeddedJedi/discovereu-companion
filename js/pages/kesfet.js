// js/pages/kesfet.js
// Eğlence & Kapsayıcılık page: fun cards + inclusion + settings.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let activeCard = null;
let unsubscribers = [];

const FUN_CARDS = [
  { id: 'bingo',      icon: '🎯', accentVar: '--fun-purple', labelKey: 'fun.card.bingo',      teaserKey: 'fun.teaser.bingo' },
  { id: 'dares',      icon: '⚡', accentVar: '--fun-orange', labelKey: 'fun.card.dares',      teaserKey: 'fun.teaser.dares' },
  { id: 'futureMe',   icon: '💌', accentVar: '--fun-teal',   labelKey: 'fun.card.futureMe',   teaserKey: 'fun.teaser.futureMe' },
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

  const page = h('div', { class: 'fun-page' });
  page.appendChild(h('h1', { class: 'page-title' }, t('kesfet.pageTitle')));

  if (activeCard) {
    renderExpanded(page);
  } else {
    renderGrid(page);

    // Inclusion section
    const inclusionSection = h('section', { class: 'plan-section', style: { marginTop: 'var(--space-8)' } });
    inclusionSection.appendChild(h('h2', { class: 'page-title', style: { fontSize: 'var(--text-xl)' } }, t('kesfet.inclusionTitle')));
    import('../ui/inclusion.js').then(mod => {
      if (mod.renderInclusionPanel) mod.renderInclusionPanel(inclusionSection);
    }).catch(() => {});
    page.appendChild(inclusionSection);

    // Settings section
    page.appendChild(renderSettings());
  }

  containerEl.appendChild(page);
}

function renderGrid(page) {
  const grid = h('div', { class: 'fun-grid' });
  FUN_CARDS.forEach(card => {
    const teaser = getTeaser(card.id);
    grid.appendChild(h('button', {
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
    ]));
  });
  page.appendChild(grid);
}

async function renderExpanded(page) {
  const card = FUN_CARDS.find(c => c.id === activeCard);
  if (!card) { activeCard = null; render(); return; }

  page.appendChild(h('button', {
    class: 'fun-back-btn', type: 'button',
    onclick: () => { activeCard = null; render(); }
  }, [h('span', null, '←'), h('span', null, ' ' + t('fun.backToGrid'))]));

  page.appendChild(h('div', { class: 'fun-expanded-header' }, [
    h('span', { class: 'fun-expanded-icon' }, card.icon),
    h('h2', null, t(card.labelKey))
  ]));

  const contentArea = h('div', { class: 'fun-expanded-content' });
  page.appendChild(contentArea);

  try {
    if (!subModules[activeCard]) {
      switch (activeCard) {
        case 'bingo':      subModules.bingo      = await import('../ui/bingo-tab.js'); break;
        case 'dares':      subModules.dares      = await import('../features/daily-dare.js'); break;
        case 'futureMe':   subModules.futureMe   = await import('../features/future-me.js'); break;
        case 'soundtrack': subModules.soundtrack = await import('../features/soundtrack.js'); break;
      }
    }
    const mod = subModules[activeCard];
    if (mod?.renderInto) await mod.renderInto(contentArea);
  } catch (err) {
    console.error(`[kesfet] failed to load ${activeCard}`, err);
    contentArea.textContent = t('fun.loadError');
  }
}

function renderSettings() {
  const currentLang = state.getSlice('language') || 'en';
  const currentTheme = state.getSlice('theme') || 'light';

  return h('section', { class: 'more-section', style: { marginTop: 'var(--space-8)' } }, [
    h('h2', { class: 'more-section-title' }, t('more.section.settings')),
    h('div', { class: 'more-settings' }, [
      h('div', { class: 'more-setting-row' }, [
        h('label', { for: 'pageLangSelect' }, t('more.language')),
        h('select', {
          id: 'pageLangSelect',
          onchange: async (ev) => {
            const { i18n } = await import('../i18n/i18n.js');
            await i18n.load(ev.target.value);
          }
        }, ['en', 'tr', 'de', 'fr', 'es', 'it'].map(code =>
          h('option', { value: code, selected: code === currentLang }, code.toUpperCase())
        ))
      ]),
      h('div', { class: 'more-setting-row' }, [
        h('label', null, t('more.themeLabel')),
        h('div', { class: 'more-theme-toggle' }, ['light', 'dark'].map(theme =>
          h('button', {
            class: `chip ${currentTheme === theme ? 'chip-active' : ''}`,
            type: 'button',
            onclick: () => { state.set('theme', theme); document.documentElement.setAttribute('data-theme', theme); }
          }, t(`more.theme.${theme}`))
        ))
      ]),
      h('div', { class: 'more-setting-row' }, [
        h('label', { for: 'pageAiKey' }, t('more.aiKey')),
        h('input', {
          id: 'pageAiKey', type: 'password', class: 'input', placeholder: 'gsk_...',
          value: localStorage.getItem('discoveru:ai.groqKey') || '',
          onchange: (ev) => {
            const key = ev.target.value.trim();
            if (key) { localStorage.setItem('discoveru:ai.groqKey', key); state.update('ai', ai => ({ ...ai, groqKey: key })); }
            else { localStorage.removeItem('discoveru:ai.groqKey'); state.update('ai', ai => ({ ...ai, groqKey: null })); }
          }
        })
      ]),
      h('button', {
        class: 'btn btn-danger more-clear-btn', type: 'button',
        onclick: () => { if (confirm(t('more.clearConfirm'))) { state.reset(); location.reload(); } }
      }, t('more.clearData')),
      h('div', { class: 'more-about' }, [
        h('p', null, t('more.about')),
        h('a', { href: 'https://github.com/embeddedJedi/discovereu-companion', target: '_blank', rel: 'noopener' }, 'GitHub')
      ])
    ])
  ]);
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
    default: return '';
  }
}
