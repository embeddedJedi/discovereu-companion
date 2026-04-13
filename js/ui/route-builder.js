// js/ui/route-builder.js
// Owns the "Route" tab. Renders two views based on state.route.stops:
//   • empty  → template gallery (start-from-template)
//   • filled → stop list + travel-days progress + clear/reset
//
// Drag-drop reordering + mandatory reservation warnings are layered on top
// later (Tasks #5 and #6) — this file keeps its seams clean so those
// additions stay local.

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on, escape } from '../utils/dom.js';
import { getRouteReservations } from '../features/reservations.js';
import { computeSeatCredits } from '../features/seat-credits.js';
import { computeCO2 } from '../features/co2.js';
import { checkNightArrivals, hasLateArrival } from '../features/night-shield.js';
import { resolveHomeCoords, renderHomeCityPicker } from './home-city-picker.js';
import { getCitiesWithBuddies } from '../features/buddy.js';

// Cached buddy cities list — loaded once on first render. While pending,
// `_buddyCities` stays null and stop cards render without the badge; as
// soon as the fetch resolves we trigger one state-driven re-render so the
// badges appear without further user interaction.
let _buddyCities = null;
let _buddyLoading = false;
function ensureBuddyCitiesLoaded() {
  if (_buddyCities || _buddyLoading) return;
  _buddyLoading = true;
  getCitiesWithBuddies()
    .then(list => {
      _buddyCities = Array.isArray(list) ? list : [];
      // Touch the route slice so subscribed render() fires — passes a
      // shallow copy to guarantee referential change.
      const r = state.getSlice('route');
      if (r) state.set('route', { ...r });
    })
    .catch(() => { _buddyCities = []; })
    .finally(() => { _buddyLoading = false; });
}

function openBuddyPanelForCity(initialCity) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('buddy.panel.title')
  });
  const box = h('div', { class: 'modal-box buddy-modal-box' });
  const closeBtn = h('button', {
    class: 'btn btn-ghost btn-sm modal-close',
    type: 'button',
    'aria-label': 'Close',
    onclick: () => backdrop.remove()
  }, '×');
  const content = h('div', { class: 'buddy-modal-content' });
  box.append(closeBtn, content);
  backdrop.appendChild(box);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);

  import('./buddy-panel.js')
    .then(mod => {
      if (typeof mod.renderBuddyPanel === 'function') {
        mod.renderBuddyPanel(content, { initialCity });
      }
    })
    .catch(err => { console.warn('[buddy] panel load failed', err); });
}

export function initRouteBuilder() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    if (state.getSlice('panelTab') !== 'route') return;
    renderInto(body);
  };

  state.subscribe('panelTab',       render);
  state.subscribe('route',          render);
  state.subscribe('routeTemplates', render);
  state.subscribe('countries',      render);
  state.subscribe('reservations',   render);
  state.subscribe('language',       render);
  state.subscribe('user',           render);

  render();
}

// ─── Top-level render ────────────────────────────────────────────────────

function renderInto(root) {
  empty(root);
  ensureBuddyCitiesLoaded();
  const route = state.getSlice('route') || { stops: [], travelDaysLimit: 7 };
  const templates = state.getSlice('routeTemplates') || [];

  const panel = h('div', { class: 'route-panel' }, [
    renderHomeChip(),
    renderHeader(route),
    route.stops.length > 0
      ? renderStopList(route)
      : renderEmptyState(),
    renderReturnSection(route),
    route.stops.length > 1 ? renderReservationsSection(route) : null,
    route.stops.length > 1 ? renderCO2Section(route) : null,
    route.stops.length > 0 ? renderShareActions() : null,
    renderTemplatesSection(templates, route.stops.length > 0)
  ]);

  root.appendChild(panel);
  wireActions(panel);
}

// ─── Header + progress ───────────────────────────────────────────────────

function renderHeader(route) {
  const nights = sumNights(route);
  const limit = route.travelDaysLimit || 7;
  const pct = Math.min(100, Math.round((nights / limit) * 100));
  const warnClass = nights > limit ? 'danger' : nights === limit ? 'warn' : '';

  const credits = computeSeatCredits(route);
  const creditPct = Math.min(100, Math.round((credits.used / credits.limit) * 100));
  const creditWarnClass = credits.exceeded
    ? 'danger'
    : credits.used === credits.limit
      ? 'warn'
      : '';

  return h('header', { class: 'route-header' }, [
    h('h2', { class: 'route-title' }, t('route.title')),

    // Travel days (7-day limit)
    h('div', { class: 'progress-label' }, [
      h('span', null, t('route.daysUsed', { used: nights, limit })),
      h('strong', null, `${pct}%`)
    ]),
    h('div', { class: 'progress' }, [
      h('div', { class: `progress-bar ${warnClass}`, style: { width: `${pct}%` } })
    ]),

    // Seat credits (4 free international reservations)
    route.stops.length > 1
      ? h('div', { class: 'seat-credits-row' }, [
          h('div', { class: 'progress-label' }, [
            h('span', null, t('route.seatCredits', { used: credits.used, limit: credits.limit })),
            credits.domesticPaid > 0
              ? h('span', { class: 'seat-credits-note' },
                  t('route.domesticPaid', { n: credits.domesticPaid }))
              : null
          ]),
          h('div', { class: 'progress progress-sm' }, [
            h('div', {
              class: `progress-bar ${creditWarnClass}`,
              style: { width: `${creditPct}%` }
            })
          ])
        ])
      : null
  ]);
}

function sumNights(route) {
  return (route.stops || []).reduce((n, s) => n + (Number(s.nights) || 0), 0);
}

// ─── Stop list ───────────────────────────────────────────────────────────

function renderStopList(route) {
  const trains = state.getSlice('trains') || [];
  const arrivals = checkNightArrivals(route, trains);

  const list = h('ol', { class: 'route-stops' },
    route.stops.map((stop, i) => renderStop(stop, i, arrivals[i])));

  return h('section', { class: 'route-section' }, [
    h('div', { class: 'route-section-head' }, [
      h('h3', null, `${route.stops.length}`),
      h('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        'data-action': 'clear-route'
      }, t('route.clear'))
    ]),
    list
  ]);
}

function renderStop(stop, index, arrival) {
  const country = countryById(stop.countryId);
  const name = country?.name || stop.countryId;
  const flag = country?.flag || '';
  const nights = Number(stop.nights) || 0;
  const isLate = !!arrival?.isLate;
  const arrivalLabel = arrival?.arrivalEstimate || '';

  return h('li', {
    class: 'route-stop' + (isLate ? ' is-late' : ''),
    'data-stop-index': index,
    draggable: 'true'
  }, [
    h('span', {
      class: 'route-stop-drag',
      'aria-hidden': 'true',
      title: 'Drag to reorder'
    }, '⋮⋮'),
    h('span', { class: 'route-stop-index' }, String(index + 1)),
    h('div', { class: 'route-stop-body' }, [
      h('div', { class: 'route-stop-name' }, [
        `${flag} ${escape(name)} `,
        isLate
          ? h('span', {
              class: 'badge badge-warning night-shield-badge',
              title: t('nightShield.lateArrivalTooltip', { time: arrivalLabel }),
              'aria-label': t('nightShield.lateArrivalTooltip', { time: arrivalLabel })
            }, [
              h('span', { 'aria-hidden': 'true' }, '🌙 '),
              h('span', null, t('nightShield.lateArrivalBadge'))
            ])
          : null
      ]),
      h('div', { class: 'route-stop-meta' },
        t('route.stopNights', { n: nights })),
      renderBuddyStopBadge(stop)
    ]),
    h('div', { class: 'route-stop-nights' }, [
      h('button', {
        class: 'nights-btn',
        type: 'button',
        'aria-label': '-1 night',
        'data-action': 'dec-nights',
        'data-stop-index': index,
        disabled: nights <= 1
      }, '−'),
      h('button', {
        class: 'nights-btn',
        type: 'button',
        'aria-label': '+1 night',
        'data-action': 'inc-nights',
        'data-stop-index': index
      }, '+')
    ]),
    h('button', {
      class: 'route-stop-remove',
      type: 'button',
      'aria-label': t('route.removeStop'),
      'data-action': 'remove-stop',
      'data-stop-index': index
    }, '×')
  ]);
}

// Small inline badge under a stop's city name when that city has a seeded
// buddy-matching room. Returns null when there's no match (or the cache
// hasn't loaded yet) so the caller can drop it into an array safely.
function renderBuddyStopBadge(stop) {
  if (!_buddyCities || !stop || !stop.cityId) return null;
  const hit = _buddyCities.find(c => c && c.cityId === stop.cityId);
  if (!hit) return null;
  return h('button', {
    class: 'buddy-stop-badge',
    type: 'button',
    'aria-label': t('buddy.panel.title'),
    onclick: (ev) => {
      ev.stopPropagation();
      openBuddyPanelForCity(stop.cityId);
    }
  }, [
    h('span', { 'aria-hidden': 'true' }, '🤝 '),
    h('span', null, t('buddy.panel.title'))
  ]);
}

function renderEmptyState() {
  return h('div', { class: 'route-empty' }, [
    h('p', { class: 'route-empty-text' }, t('route.empty'))
  ]);
}

// ─── Reservations section ────────────────────────────────────────────────

function renderReservationsSection(route) {
  const reservations = getRouteReservations(route);
  if (reservations.length === 0) {
    return h('section', { class: 'route-section' }, [
      h('h3', { class: 'route-section-title' }, t('route.reservations.title')),
      h('div', { class: 'alert alert-success' }, [
        h('span', null, t('route.reservations.none'))
      ])
    ]);
  }

  const credits = computeSeatCredits(route);

  return h('section', { class: 'route-section' }, [
    h('h3', { class: 'route-section-title' }, t('route.reservations.title')),
    h('p', { class: 'route-section-sub' }, t('route.reservations.sub')),

    credits.exceeded
      ? h('div', { class: 'alert alert-danger' }, [
          h('strong', null, t('route.warnings.seatCreditsExhausted'))
        ])
      : null,

    h('div', { class: 'reservation-list' },
      reservations.map(r => renderReservationCard(r)))
  ]);
}

function renderReservationCard(r) {
  const fromCountry = countryById(r.legFrom);
  const toCountry   = countryById(r.legTo);
  const fromFlag = fromCountry?.flag || r.legFrom;
  const toFlag   = toCountry?.flag || r.legTo;
  const sameCountry = r.legFrom === r.legTo;
  const badgeKey = sameCountry ? 'route.reservations.domestic' : 'route.reservations.international';

  return h('article', { class: 'reservation-card' }, [
    h('div', { class: 'reservation-head' }, [
      h('span', { class: 'reservation-leg' },
        sameCountry ? `${fromFlag} ${fromCountry?.name || r.legFrom}` : `${fromFlag} → ${toFlag}`),
      h('span', { class: 'badge badge-warning' }, t(badgeKey))
    ]),
    h('div', { class: 'reservation-route' }, r.sampleRoute || ''),
    h('div', { class: 'reservation-meta' }, [
      h('span', { class: 'reservation-operator' }, r.operator || ''),
      r.costEUR
        ? h('span', { class: 'reservation-cost' }, `≈ €${r.costEUR}`)
        : null
    ]),
    r.notes ? h('p', { class: 'reservation-notes' }, r.notes) : null
  ]);
}

// ─── Share actions ───────────────────────────────────────────────────────

function renderShareActions() {
  return h('section', { class: 'route-share-actions' }, [
    h('button', {
      class: 'btn btn-primary btn-block',
      type: 'button',
      'data-wrapped-trigger': 'true'
    }, [
      h('span', null, '✨ '),
      h('span', null, t('route.shareActions.wrap'))
    ]),
    h('button', {
      class: 'btn btn-secondary btn-block',
      type: 'button',
      'data-action': 'export-pdf'
    }, [
      h('span', null, '📄 '),
      h('span', null, t('route.shareActions.pdf'))
    ])
  ]);
}

// ─── CO₂ section ─────────────────────────────────────────────────────────

function renderCO2Section(route) {
  const co2 = computeCO2(route);
  if (co2.totalKm === 0) return document.createDocumentFragment();

  return h('section', { class: 'co2-card' }, [
    h('div', { class: 'co2-head' }, [
      h('span', { class: 'co2-icon', 'aria-hidden': 'true' }, '🌱'),
      h('div', null, [
        h('h3', { class: 'co2-title' }, t('co2.title')),
        h('p', { class: 'co2-sub' },
          t('co2.savedLine', { kg: co2.savedKg, pct: co2.savedPct }))
      ]),
      co2.green
        ? h('span', { class: 'badge badge-success' }, t('co2.greenTraveler'))
        : null
    ]),
    h('div', { class: 'co2-grid' }, [
      h('div', { class: 'co2-stat' }, [
        h('span', { class: 'co2-label' }, t('co2.distance')),
        h('span', { class: 'co2-value' }, t('co2.km', { km: co2.totalKm }))
      ]),
      h('div', { class: 'co2-stat' }, [
        h('span', { class: 'co2-label' }, t('co2.byRail')),
        h('span', { class: 'co2-value co2-good' }, `${co2.railKg} kg`)
      ]),
      h('div', { class: 'co2-stat' }, [
        h('span', { class: 'co2-label' }, t('co2.ifFlew')),
        h('span', { class: 'co2-value co2-bad' }, `${co2.flightKg} kg`)
      ])
    ])
  ]);
}

// ─── Templates gallery ───────────────────────────────────────────────────

function renderTemplatesSection(templates, compact) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return document.createDocumentFragment();
  }

  return h('section', { class: 'route-section' }, [
    h('h3', { class: 'route-section-title' },
      compact ? t('route.templates.more') : t('route.templates.title')),
    h('p', { class: 'route-section-sub' }, t('route.templates.sub')),
    h('div', { class: 'template-grid' },
      templates.map(tpl => renderTemplateCard(tpl)))
  ]);
}

function renderTemplateCard(tpl) {
  const countries = (tpl.countries || [])
    .map(id => countryById(id))
    .filter(Boolean);

  const flags = countries.map(c => c.flag || c.id).join(' ');

  // Night Arrival Shield: mark templates whose legs would arrive at night.
  const trains = state.getSlice('trains') || [];
  const tplRoute = { stops: (tpl.countries || []).map(id => ({ countryId: id, cityId: null })) };
  const tplLate  = hasLateArrival(tplRoute, trains);
  const filters  = state.getSlice('filters') || {};
  const hide     = !!filters.hideLateArrival && tplLate;

  return h('article', {
    class: 'template-card' + (hide ? ' template-dimmed' : ''),
    'data-template-id': tpl.id
  }, [
    hide
      ? h('div', { class: 'template-dim-note', role: 'note' },
          t('nightShield.templateFilteredNote'))
      : null,
    h('header', { class: 'template-head' }, [
      h('span', { class: 'template-emoji', 'aria-hidden': 'true' }, tpl.emoji || '🗺'),
      h('div', { class: 'template-head-text' }, [
        h('h4', { class: 'template-name' }, tpl.name),
        h('p', { class: 'template-tag' }, tpl.tagline || '')
      ])
    ]),
    h('p', { class: 'template-desc' }, tpl.description || ''),
    h('div', { class: 'template-flags', 'aria-label': 'Countries in this route' }, flags),
    h('footer', { class: 'template-footer' }, [
      h('div', { class: 'template-meta' }, [
        h('span', { class: 'badge badge-soft' }, t('route.templates.days', { n: tpl.days || 0 })),
        h('span', { class: 'badge badge-soft' },
          t('route.templates.countries', { n: countries.length }))
      ]),
      h('button', {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        'data-action': 'use-template',
        'data-template-id': tpl.id
      }, t('route.templates.use'))
    ])
  ]);
}

// ─── Actions ─────────────────────────────────────────────────────────────

function wireActions(panel) {
  on(panel, 'click', '[data-action="use-template"]', (_ev, target) => {
    applyTemplate(target.dataset.templateId);
  });

  on(panel, 'click', '[data-action="remove-stop"]', (_ev, target) => {
    const index = Number(target.dataset.stopIndex);
    state.update('route', r => ({
      ...r,
      stops: r.stops.filter((_, i) => i !== index)
    }));
  });

  on(panel, 'click', '[data-action="inc-nights"]', (_ev, target) => {
    const index = Number(target.dataset.stopIndex);
    updateStopNights(index, +1);
  });

  on(panel, 'click', '[data-action="dec-nights"]', (_ev, target) => {
    const index = Number(target.dataset.stopIndex);
    updateStopNights(index, -1);
  });

  on(panel, 'click', '[data-action="clear-route"]', () => {
    state.update('route', r => ({ ...r, stops: [] }));
  });

  on(panel, 'click', '[data-action="export-pdf"]', async () => {
    const mod = await import('../features/pdf-export.js');
    mod.exportItineraryPDF();
  });

  wireDragAndDrop(panel);
}

function updateStopNights(index, delta) {
  state.update('route', r => ({
    ...r,
    stops: r.stops.map((s, i) =>
      i === index ? { ...s, nights: Math.max(1, (Number(s.nights) || 0) + delta) } : s
    )
  }));
}

// ─── Drag-and-drop reordering ────────────────────────────────────────────
//
// HTML5 DnD. We stash the dragged index in dataTransfer (+ a module-local
// variable as a fallback, because Safari doesn't read dataTransfer during
// dragover). On drop we splice the stops array to the new position.

let dragFromIndex = -1;

function wireDragAndDrop(panel) {
  const list = panel.querySelector('.route-stops');
  if (!list) return;

  list.addEventListener('dragstart', (ev) => {
    const stop = ev.target.closest?.('.route-stop');
    if (!stop) return;
    dragFromIndex = Number(stop.dataset.stopIndex);
    stop.classList.add('dragging');
    try { ev.dataTransfer.setData('text/plain', String(dragFromIndex)); } catch {}
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', (ev) => {
    const stop = ev.target.closest?.('.route-stop');
    if (stop) stop.classList.remove('dragging');
    list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragFromIndex = -1;
  });

  list.addEventListener('dragover', (ev) => {
    const stop = ev.target.closest?.('.route-stop');
    if (!stop) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    stop.classList.add('drag-over');
  });

  list.addEventListener('dragleave', (ev) => {
    const stop = ev.target.closest?.('.route-stop');
    if (stop && !stop.contains(ev.relatedTarget)) stop.classList.remove('drag-over');
  });

  list.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const target = ev.target.closest?.('.route-stop');
    if (!target) return;
    const toIndex = Number(target.dataset.stopIndex);
    const fromIndex = dragFromIndex >= 0
      ? dragFromIndex
      : Number(ev.dataTransfer?.getData('text/plain'));
    dragFromIndex = -1;
    if (!Number.isFinite(fromIndex) || fromIndex === toIndex) return;

    state.update('route', r => {
      const next = [...r.stops];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...r, stops: next };
    });
  });
}

function applyTemplate(templateId) {
  const templates = state.getSlice('routeTemplates') || [];
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;

  const countries = state.getSlice('countries') || [];
  // Only include stops whose country we actually have data for.
  // (All 36 should load, but we stay tolerant if a template references
  //  a country that got removed from the dataset.)
  const valid = (tpl.countries || []).filter(id => countries.some(c => c.id === id));
  const nightsEach = Math.max(1, Math.floor((tpl.days || 7) / valid.length));

  const stops = valid.map(id => ({
    countryId: id,
    cityId: null,
    nights: nightsEach,
    arrivalDay: null,
    transport: 'train'
  }));

  state.update('route', r => ({
    ...r,
    stops,
    returnStops: tpl.returnLeg?.stops || [],
    returnTransport: tpl.returnLeg?.transport || 'train',
    travelDaysLimit: Math.max(r.travelDaysLimit || 7, tpl.days || 7),
    name: tpl.name
  }));
}

// ─── Home chip + home modal ──────────────────────────────────────────────

function renderHomeChip() {
  const home = resolveHomeCoords();
  const label = home ? t('route.home.chip', { city: home.name }) : t('route.home.modalTitle');
  return h('button', {
    class: 'home-chip',
    type: 'button',
    'aria-label': t('route.home.edit'),
    onclick: () => openHomeModal()
  }, [
    h('span', { 'aria-hidden': 'true' }, '🏠 '),
    h('span', { class: 'home-chip-label' }, label),
    ' ',
    h('span', { class: 'home-chip-edit' }, t('route.home.edit'))
  ]);
}

function openHomeModal() {
  const backdrop = h('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' });
  const box = h('div', { class: 'modal-box' });
  const title = h('h2', {}, t('route.home.modalTitle'));
  const pickerBox = h('div');

  const user = state.getSlice('user');
  let pending = { countryId: user.homeCountry, cityId: user.homeCity };

  renderHomeCityPicker(pickerBox, {
    countryId: pending.countryId,
    cityId: pending.cityId,
    onChange: (p) => { pending = p; }
  });

  const save = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    onclick: () => {
      state.update('user', u => ({
        ...u,
        homeCountry: pending.countryId,
        homeCity: pending.cityId
      }));
      backdrop.remove();
    }
  }, t('route.home.save'));

  box.append(title, pickerBox, save);
  backdrop.append(box);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

// ─── Return section ──────────────────────────────────────────────────────

function renderReturnSection(route) {
  const home = resolveHomeCoords();
  const returnStops = route.returnStops || [];
  const includeInBudget = !!route.includeReturnInBudget;
  const returnTransport = route.returnTransport || 'train';

  const section = h('section', {
    class: 'route-return-section',
    'aria-label': t('route.return.sectionTitle')
  });

  section.append(h('h3', { class: 'route-section-title' }, t('route.return.sectionTitle')));

  // Include-in-budget toggle.
  const toggle = h('label', { class: 'toggle-row' }, [
    h('input', {
      type: 'checkbox',
      role: 'switch',
      checked: includeInBudget,
      'aria-checked': String(includeInBudget),
      onchange: (e) => state.update('route', r => ({
        ...r,
        includeReturnInBudget: e.target.checked
      }))
    }),
    h('span', {}, t('route.return.toggleLabel'))
  ]);
  section.append(toggle);

  // Return stops list — each row uses the shared stop editor helper.
  const list = h('div', { class: 'return-stops-list' });
  returnStops.forEach((stop, i) => {
    list.append(renderStopEditor(stop, i, {
      onUpdate: (next) => state.update('route', r => {
        const arr = [...(r.returnStops || [])];
        arr[i] = next;
        return { ...r, returnStops: arr };
      }),
      onRemove: () => state.update('route', r => ({
        ...r,
        returnStops: (r.returnStops || []).filter((_, j) => j !== i)
      }))
    }));
  });
  if (returnStops.length === 0) {
    list.append(h('p', { class: 'muted' }, t('route.return.directHint')));
  }
  section.append(list);

  // Add return stop button.
  const addBtn = h('button', {
    class: 'btn btn-secondary btn-sm',
    type: 'button',
    onclick: () => state.update('route', r => ({
      ...r,
      returnStops: [
        ...(r.returnStops || []),
        { countryId: '', cityId: '', nights: 1, transport: 'train' }
      ]
    }))
  }, t('route.return.addStop'));
  section.append(addBtn);

  // Fixed home card with transport select.
  const homeLabel = home
    ? t('route.return.homeCard', { city: home.name })
    : t('route.home.modalTitle');

  const transportSelect = h('select', {
    'aria-label': t('route.return.sectionTitle'),
    onchange: (e) => state.update('route', r => ({ ...r, returnTransport: e.target.value }))
  }, ['train', 'bus', 'flight'].map(mode =>
    h('option', { value: mode, selected: mode === returnTransport }, mode)
  ));

  const homeCard = h('div', { class: 'return-home-card' }, [
    h('span', { 'aria-hidden': 'true' }, '→ 🏠 '),
    h('span', { class: 'return-home-label' }, homeLabel),
    transportSelect
  ]);
  section.append(homeCard);

  // Optimize-with-AI button.
  const optimizeBtn = h('button', {
    class: 'btn-ai',
    type: 'button',
    onclick: async () => {
      // Ensure ai-assistant.js has registered its window listener before
      // the event fires — the module is otherwise lazy-loaded only when
      // the AI trigger button is clicked, so the first optimize-return
      // click would be swallowed silently.
      await import('../features/ai-assistant.js');
      window.dispatchEvent(new CustomEvent('ai:optimize-return'));
    }
  }, t('route.return.optimizeBtn'));
  section.append(optimizeBtn);

  return section;
}

// ─── Shared stop editor (used by return stops) ───────────────────────────
//
// A compact, callback-driven row for editing a single stop. Outbound stops
// keep their richer renderer (`renderStop`) with drag-and-drop + late-
// arrival badges + delegated data-actions; that behaviour is unchanged.
// This helper exists so the return list can reuse the same country/city
// picker + nights stepper pattern without dragging outbound's subsystems
// along with it.

function renderStopEditor(stop, index, { onUpdate, onRemove }) {
  const countries = state.getSlice('countries') || [];
  const country   = countries.find(c => c.id === stop.countryId) || null;
  const cities    = country?.cities || [];
  const nights    = Number(stop.nights) || 1;

  const countrySelect = h('select', {
    'aria-label': t('route.home.country'),
    onchange: (e) => {
      const nextCountry = countries.find(c => c.id === e.target.value);
      const nextCity    = nextCountry?.cities?.[0]?.id || '';
      onUpdate({ ...stop, countryId: e.target.value, cityId: nextCity });
    }
  }, [
    h('option', { value: '', selected: !stop.countryId }, '—'),
    ...countries.map(c => h('option', {
      value: c.id,
      selected: c.id === stop.countryId
    }, c.name || c.id))
  ]);

  const citySelect = h('select', {
    'aria-label': t('route.home.city'),
    disabled: cities.length === 0,
    onchange: (e) => onUpdate({ ...stop, cityId: e.target.value })
  }, [
    h('option', { value: '', selected: !stop.cityId }, '—'),
    ...cities.map(c => h('option', {
      value: c.id,
      selected: c.id === stop.cityId
    }, c.name))
  ]);

  const dec = h('button', {
    class: 'nights-btn',
    type: 'button',
    'aria-label': '-1 night',
    disabled: nights <= 1,
    onclick: () => onUpdate({ ...stop, nights: Math.max(1, nights - 1) })
  }, '−');

  const inc = h('button', {
    class: 'nights-btn',
    type: 'button',
    'aria-label': '+1 night',
    onclick: () => onUpdate({ ...stop, nights: nights + 1 })
  }, '+');

  const nightsLabel = h('span', { class: 'return-stop-nights-label' },
    t('route.stopNights', { n: nights }));

  const removeBtn = h('button', {
    class: 'route-stop-remove',
    type: 'button',
    'aria-label': t('route.removeStop'),
    onclick: () => onRemove()
  }, '×');

  return h('div', {
    class: 'return-stop-editor',
    'data-return-stop-index': index
  }, [
    h('div', { class: 'return-stop-selects' }, [countrySelect, citySelect]),
    h('div', { class: 'return-stop-nights' }, [dec, nightsLabel, inc]),
    removeBtn
  ]);
}

// ─── Page-level export ──────────────────────────────────────────────────
export { renderInto as renderRoutePanel };
