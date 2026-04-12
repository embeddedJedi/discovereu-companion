// js/ui/fun-tab.js
// "Eğlence" tab shell: sub-tab bar (Bingo · Daily Dare · FutureMe) with
// keyboard ←/→ navigation and local-only activeFunSubtab state.
// Each sub-tab lazy-imports its renderer to keep initial cost low.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, on, empty } from '../utils/dom.js';

const SUBTABS = ['bingo', 'dares', 'futureMe'];

export function initFunTab() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = async () => {
    if (state.getSlice('panelTab') !== 'fun') return;
    await renderFunShell(body);
  };

  state.subscribe('panelTab',        render);
  state.subscribe('activeFunSubtab', render);
  state.subscribe('language',        render);
  state.subscribe('route',           render);
  state.subscribe('bingo',           render);
  state.subscribe('dares',           render);
  state.subscribe('futureMessages',  render);

  render();
}

async function renderFunShell(root) {
  empty(root);
  const active = state.getSlice('activeFunSubtab') || 'bingo';

  const bar = h('nav', { class: 'fun-subtabs', role: 'tablist', 'aria-label': t('fun.subtabLabel') });
  for (const key of SUBTABS) {
    const btn = h('button', {
      class: `fun-subtab ${active === key ? 'is-active' : ''}`,
      role: 'tab',
      type: 'button',
      'aria-selected': active === key ? 'true' : 'false',
      'data-subtab': key
    }, [
      h('span', null, subtabEmoji(key)),
      h('span', null, t(`fun.subtab.${key}`))
    ]);
    on(btn, 'click', () => state.set('activeFunSubtab', key));
    on(btn, 'keydown', ev => {
      const i = SUBTABS.indexOf(key);
      if (ev.key === 'ArrowRight') state.set('activeFunSubtab', SUBTABS[(i + 1) % SUBTABS.length]);
      if (ev.key === 'ArrowLeft')  state.set('activeFunSubtab', SUBTABS[(i - 1 + SUBTABS.length) % SUBTABS.length]);
    });
    bar.appendChild(btn);
  }
  root.appendChild(bar);

  const panel = h('div', { class: `fun-panel fun-panel-${active}`, role: 'tabpanel' });
  root.appendChild(panel);

  if (active === 'bingo') {
    const { renderBingo } = await import('./bingo-tab.js');
    await renderBingo(panel);
  } else if (active === 'dares') {
    const { ensureDares, pickTodaysDare, renderDareCard } = await import('../features/daily-dare.js');
    const dares = await ensureDares();
    const today = pickTodaysDare(dares, state.getSlice('route'));
    renderDareCard(panel, today);
  } else if (active === 'futureMe') {
    const { renderFutureMe } = await import('../features/future-me.js');
    renderFutureMe(panel);
  }
}

function subtabEmoji(key) {
  return { bingo: '🎯', dares: '⚡', futureMe: '🕰️' }[key] || '⭐';
}
