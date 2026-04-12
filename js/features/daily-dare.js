// js/features/daily-dare.js
// Deterministic dare rotation + streak tracking. Picks today's dare
// using (dayOfYear ^ FNV1a(YYYY)) seed so every device sees the same
// dare on the same day with zero network traffic.

import { state } from '../state.js';
import { loadDares } from '../data/loader.js';
import { h, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';

let _dares = null;

function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.floor(diff / 86400000);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export async function ensureDares() {
  if (_dares) return _dares;
  const d = await loadDares();
  _dares = d.dares || [];
  return _dares;
}

export function pickTodaysDare(dares, route, today = new Date()) {
  if (!dares?.length) return null;
  const seed = dayOfYear(today) ^ fnv1a(String(today.getFullYear()));
  const routeCountries = new Set((route?.stops || []).map(s => s.countryId));
  const preferred = dares.filter(d => d.preferredCountries?.length && d.preferredCountries.some(c => routeCountries.has(c)));
  const pool = preferred.length ? preferred : dares.filter(d => !d.preferredCountries?.length);
  const index = seed % pool.length;
  return pool[index];
}

export function markDareDone(dateKey = isoDay()) {
  state.update('dares', prev => ({
    ...prev,
    completed: { ...prev.completed, [dateKey]: true },
    streak: computeStreak({ ...prev.completed, [dateKey]: true })
  }));
}

export function skipToday(dateKey = isoDay()) {
  state.update('dares', prev => ({
    ...prev,
    completed: { ...prev.completed, [dateKey]: 'skipped' },
    streak: computeStreak({ ...prev.completed, [dateKey]: 'skipped' })
  }));
}

export function computeStreak(completed) {
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = isoDay(cursor);
    const v = completed[key];
    if (v === true) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
    if (v === 'skipped' && streak === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
    break;
  }
  return streak;
}

export function getStreak() {
  return state.getSlice('dares')?.streak ?? 0;
}

export function isTodayDone() {
  return state.getSlice('dares')?.completed?.[isoDay()] === true;
}

export function renderDareCard(container, dare) {
  if (!container) return;
  container.innerHTML = '';
  if (!dare) {
    container.appendChild(h('p', { class: 'text-muted' }, t('dares.noneToday')));
    return;
  }
  const useTr = state.getSlice('language') === 'tr';
  const title = useTr ? dare.titleTr : dare.title;
  const streak = getStreak();
  const done = isTodayDone();

  const card = h('section', { class: `dare-card ${done ? 'is-done' : ''}` }, [
    h('div', { class: 'dare-emoji' }, dare.emoji || '⭐'),
    h('h3', null, title),
    h('p', { class: 'dare-meta' }, [
      h('span', null, `🏅 +${dare.xp} XP`),
      ' · ',
      h('span', null, t('dares.streakLabel', { days: streak }))
    ]),
    h('div', { class: 'dare-actions' }, [
      (() => {
        const b = h('button', { class: done ? 'btn btn-secondary' : 'btn btn-primary', type: 'button' },
          done ? t('dares.done') : t('dares.markDone'));
        on(b, 'click', () => { markDareDone(); renderDareCard(container, dare); });
        return b;
      })(),
      (() => {
        const s = h('button', { class: 'btn btn-ghost', type: 'button' }, t('dares.skip'));
        on(s, 'click', () => { skipToday(); renderDareCard(container, dare); });
        return s;
      })()
    ])
  ]);
  container.appendChild(card);
}
