// js/pages/kesfet.js
// Eğlence & Kapsayıcılık — game-inspired fun features.
// Each card has a distinctive visual identity.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let activeCard = null;
let unsubscribers = [];

const FUN_CARDS = [
  {
    id: 'dares',
    icon: '\u26A1',
    labelKey: 'fun.card.dares',
    teaserFn: () => {
      const streak = state.getSlice('dares')?.streak || 0;
      return streak > 0 ? `${streak} ${t('fun.dayStreak')}` : t('fun.startDare');
    },
    cssClass: 'fun-card--dare',
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7C948 100%)'
  },
  {
    id: 'bingo',
    icon: '\uD83D\uDCF8',
    labelKey: 'fun.card.bingo',
    teaserFn: () => {
      const done = Object.keys(state.getSlice('bingo')?.completed || {}).length;
      return `${done}/25 ${t('fun.challenges')}`;
    },
    cssClass: 'fun-card--bingo',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)'
  },
  {
    id: 'futureMe',
    icon: '\u2709\uFE0F',
    labelKey: 'fun.card.futureMe',
    teaserFn: () => {
      const count = (state.getSlice('futureMessages') || []).length;
      return count > 0 ? `${count} ${t('fun.capsules')}` : t('fun.writeCapsule');
    },
    cssClass: 'fun-card--letter',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)'
  },
  {
    id: 'soundtrack',
    icon: '\uD83C\uDFB5',
    labelKey: 'fun.card.soundtrack',
    teaserFn: () => t('fun.listenNow'),
    cssClass: 'fun-card--vinyl',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)'
  }
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

  const page = h('div', { class: 'kesfet-page' });

  if (activeCard) {
    renderExpanded(page);
  } else {
    // Hero
    page.appendChild(h('div', { class: 'kesfet-hero' }, [
      h('h1', { class: 'kesfet-title' }, t('kesfet.pageTitle')),
      h('p', { class: 'kesfet-subtitle' }, t('kesfet.subtitle'))
    ]));

    // Fun cards — each with unique visual identity
    const grid = h('div', { class: 'kesfet-grid' });
    FUN_CARDS.forEach(card => {
      grid.appendChild(h('button', {
        class: `kesfet-card ${card.cssClass}`,
        type: 'button',
        onclick: () => { activeCard = card.id; render(); }
      }, [
        h('div', { class: 'kesfet-card-shine' }),
        h('div', { class: 'kesfet-card-bg', style: { background: card.gradient } }),
        h('div', { class: 'kesfet-card-inner' }, [
          h('div', { class: 'kesfet-card-icon' }, card.icon),
          h('h3', { class: 'kesfet-card-title' }, t(card.labelKey)),
          h('p', { class: 'kesfet-card-teaser' }, card.teaserFn())
        ])
      ]));
    });
    page.appendChild(grid);

    // Inclusion section
    const inclusionSection = h('section', { class: 'kesfet-section' });
    inclusionSection.appendChild(h('h2', { class: 'kesfet-section-title' }, t('kesfet.inclusionTitle')));
    import('../ui/inclusion.js').then(mod => {
      if (mod.renderInclusionPanel) mod.renderInclusionPanel(inclusionSection);
    }).catch(() => {});
    page.appendChild(inclusionSection);

    // Settings
    page.appendChild(renderSettings());
  }

  containerEl.appendChild(page);
}

async function renderExpanded(page) {
  const card = FUN_CARDS.find(c => c.id === activeCard);
  if (!card) { activeCard = null; render(); return; }

  // Back button
  page.appendChild(h('button', {
    class: 'kesfet-back',
    type: 'button',
    onclick: () => { activeCard = null; render(); }
  }, [h('span', null, '\u2190'), h('span', null, t('fun.backToGrid'))]));

  // Expanded header with card's gradient
  page.appendChild(h('div', {
    class: `kesfet-expanded-hero ${card.cssClass}`,
    style: { background: card.gradient }
  }, [
    h('span', { class: 'kesfet-expanded-icon' }, card.icon),
    h('h2', { class: 'kesfet-expanded-title' }, t(card.labelKey))
  ]));

  // Content
  const contentArea = h('div', { class: 'kesfet-expanded-content' });
  page.appendChild(contentArea);

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
    if (mod?.renderInto) await mod.renderInto(contentArea);
  } catch (err) {
    console.error(`[kesfet] failed to load ${activeCard}`, err);
    contentArea.textContent = t('fun.loadError');
  }
}

function renderSettings() {
  const currentLang = state.getSlice('language') || 'en';
  const currentTheme = state.getSlice('theme') || 'light';

  return h('section', { class: 'kesfet-section kesfet-settings' }, [
    h('h2', { class: 'kesfet-section-title' }, t('more.section.settings')),
    h('div', { class: 'kesfet-settings-grid' }, [
      h('div', { class: 'kesfet-setting' }, [
        h('label', { for: 'ksLang' }, t('more.language')),
        h('select', {
          id: 'ksLang',
          onchange: async (ev) => {
            const { i18n } = await import('../i18n/i18n.js');
            await i18n.load(ev.target.value);
          }
        }, ['en', 'tr', 'de', 'fr', 'es', 'it'].map(code =>
          h('option', { value: code, selected: code === currentLang }, code.toUpperCase())
        ))
      ]),
      h('div', { class: 'kesfet-setting' }, [
        h('label', null, t('more.themeLabel')),
        h('div', { class: 'kesfet-theme-btns' }, ['light', 'dark'].map(theme =>
          h('button', {
            class: `chip ${currentTheme === theme ? 'chip-active' : ''}`,
            type: 'button',
            onclick: () => { state.set('theme', theme); document.documentElement.setAttribute('data-theme', theme); }
          }, t(`more.theme.${theme}`))
        ))
      ]),
      h('div', { class: 'kesfet-setting' }, [
        h('label', { for: 'ksAiKey' }, t('more.aiKey')),
        h('input', {
          id: 'ksAiKey', type: 'password', class: 'input', placeholder: 'gsk_...',
          value: localStorage.getItem('discoveru:ai.groqKey') || '',
          onchange: (ev) => {
            const key = ev.target.value.trim();
            if (key) { localStorage.setItem('discoveru:ai.groqKey', key); state.update('ai', ai => ({ ...ai, groqKey: key })); }
            else { localStorage.removeItem('discoveru:ai.groqKey'); state.update('ai', ai => ({ ...ai, groqKey: null })); }
          }
        })
      ])
    ]),
    h('button', {
      class: 'btn btn-danger', style: { width: '100%', marginTop: 'var(--space-4)' },
      type: 'button',
      onclick: () => { if (confirm(t('more.clearConfirm'))) { state.reset(); location.reload(); } }
    }, t('more.clearData'))
  ]);
}
