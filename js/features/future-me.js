// js/features/future-me.js
// Time capsule messages stored in localStorage. Reveal is triggered
// client-side by date comparison; an optional .ics export gives the
// user a portable calendar alarm anchor.

import { state } from '../state.js';
import { buildICS, downloadICS } from '../utils/ics.js';
import { h, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { showToast } from './../ui/toast.js';

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'fm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function listMessages() {
  return state.getSlice('futureMessages') || [];
}

export function addMessage({ message, revealDate }) {
  if (!message || !revealDate) throw new Error('[futureMe] message + revealDate required');
  const id = uuid();
  const entry = { id, message: String(message), createdAt: new Date().toISOString(), revealDate };
  state.update('futureMessages', prev => [...(prev || []), entry]);
  return id;
}

export function deleteMessage(id) {
  state.update('futureMessages', prev => (prev || []).filter(m => m.id !== id));
}

export function isRevealed(msg) {
  return Date.now() >= new Date(msg.revealDate).getTime();
}

export function getDaysUntilReveal(msg) {
  const diff = new Date(msg.revealDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function exportToCalendar(msg) {
  const ics = buildICS({
    uid: `futureme-${msg.id}@discovereu-companion`,
    summary: t('futureMe.icsSummary'),
    description: t('futureMe.icsDesc'),
    startDate: new Date(msg.revealDate),
    alarms: [{ minutesBefore: 0, description: t('futureMe.icsAlarm') }]
  });
  downloadICS(`futureme-${msg.revealDate.slice(0, 10)}.ics`, ics);
}

/**
 * Renders the FutureMe sub-tab panel: list + [+ New] button + compose
 * modal on click. Called by js/ui/fun-tab.js.
 */
export function renderFutureMe(container) {
  container.innerHTML = '';
  const useTr = state.getSlice('language') === 'tr';
  container.appendChild(h('header', { class: 'futureme-header' }, [
    h('h3', null, `🕰️ ${t('futureMe.title')}`),
    (() => {
      const b = h('button', { class: 'btn btn-primary', type: 'button' }, `+ ${t('futureMe.newBtn')}`);
      on(b, 'click', () => openCompose(container));
      return b;
    })()
  ]));

  const msgs = listMessages();
  if (!msgs.length) {
    container.appendChild(h('p', { class: 'text-muted' }, t('futureMe.empty')));
    return;
  }
  const list = h('ul', { class: 'futureme-list' });
  for (const msg of msgs) {
    const revealed = isRevealed(msg);
    const days = getDaysUntilReveal(msg);
    const item = h('li', { class: `futureme-item ${revealed ? 'is-revealed' : 'is-sealed'}` }, [
      h('div', { class: 'futureme-item-head' }, [
        h('strong', null, revealed ? '📖 ' + t('futureMe.opened') : '🔒 ' + t('futureMe.sealed')),
        h('span', { class: 'futureme-date' }, msg.revealDate.slice(0, 10))
      ]),
      revealed
        ? h('p', { class: 'futureme-message' }, msg.message)
        : h('p', { class: 'futureme-countdown' }, t('futureMe.revealedIn', { days })),
      h('div', { class: 'futureme-actions' }, [
        (() => {
          const a = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `📅 ${t('futureMe.export')}`);
          on(a, 'click', () => exportToCalendar(msg));
          return a;
        })(),
        (() => {
          const d = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `🗑 ${t('futureMe.delete')}`);
          on(d, 'click', () => {
            if (confirm(t('futureMe.confirmDelete'))) {
              deleteMessage(msg.id);
              renderFutureMe(container);
            }
          });
          return d;
        })()
      ])
    ]);
    list.appendChild(item);
  }
  container.appendChild(list);
}

// Fun page card API — renders the full FutureMe module into any container.
export { renderFutureMe as renderInto };

function openCompose(parent) {
  const overlay = h('div', { class: 'modal-overlay futureme-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const textarea = h('textarea', { class: 'input', rows: '5', placeholder: t('futureMe.placeholder') });
  const dateInput = h('input', { type: 'date', class: 'input', min: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `🕰️ ${t('futureMe.newTitle')}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      h('label', null, t('futureMe.messageLabel')),
      textarea,
      h('label', null, t('futureMe.dateLabel')),
      dateInput,
      h('div', { class: 'modal-actions' }, [
        (() => {
          const s = h('button', { class: 'btn btn-primary', type: 'button' }, t('futureMe.save'));
          on(s, 'click', () => {
            const msg = textarea.value.trim();
            const dt = dateInput.value;
            if (!msg || !dt) { showToast({ message: t('futureMe.needBoth'), variant: 'warning' }); return; }
            addMessage({ message: msg, revealDate: new Date(dt).toISOString() });
            close();
            renderFutureMe(parent);
          });
          return s;
        })()
      ])
    ])
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);

  textarea.focus();
}
