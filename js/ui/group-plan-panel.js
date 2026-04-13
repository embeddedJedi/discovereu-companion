// js/ui/group-plan-panel.js
// v1.7 — Multi-origin Group Planner: main UI panel.
//
// Renders the full group planning surface: header, members list,
// meeting-point optimizer card, integrated itinerary, and share footer.
// Subscribes to state.group and re-renders sections when the slice changes.
//
// Exports:
//   renderGroupPanel(container) -> cleanup fn
//
// All DOM is built via h() — no innerHTML. All user strings route through t().
// LZString is read via window.LZString (CDN global in index.html).

import { h, empty, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { renderMemberForm } from './group-member-form.js';
import { haversineKm } from '../features/meeting-point.js';
import {
  createGroup,
  addMember,
  removeMember,
  computeOptimalMeetingPoint,
  encodeGroupUrl,
  decodeGroupUrl,
  mergeIncomingGroup
} from '../features/group-plan.js';

const GROUP_MAX_MEMBERS = 10;
const ALTERNATIVE_RADIUS_KM = 200;

// ISO2 → regional-indicator flag emoji. Returns '' on invalid input.
function flagEmoji(cc) {
  if (typeof cc !== 'string' || cc.length !== 2) return '';
  const up = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}

function cityLabel(countryId, cityId) {
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === countryId);
  if (!country) return cityId || countryId || '';
  const city = Array.isArray(country.cities) ? country.cities.find(ct => ct.id === cityId) : null;
  return city ? (city.name || cityId) : (cityId || country.name || countryId);
}

function resolveCityCoords(countryId, cityId) {
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === countryId);
  if (!country || !Array.isArray(country.cities)) return null;
  const city = country.cities.find(ct => ct.id === cityId);
  if (!city) return null;
  const lat = Number(city.lat);
  const lng = Number(city.lng ?? city.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// CO2 estimate — rough, matches the Impact Dashboard heuristics
// (train at ~35 g/km). Fine-grained modal breakdown is out of scope here.
function estimateCo2Kg(distanceKm) {
  return Math.round((distanceKm * 0.035) * 10) / 10;
}

// Find up to N cities within ALTERNATIVE_RADIUS_KM of the snapped optimum,
// excluding the optimum itself. Pool: countries.json city entries.
function findAlternatives(snapped, countries, max = 2) {
  if (!snapped || !Array.isArray(countries)) return [];
  const out = [];
  for (const country of countries) {
    if (!Array.isArray(country.cities)) continue;
    for (const city of country.cities) {
      if (country.id === snapped.countryId && city.id === snapped.cityId) continue;
      const lat = Number(city.lat);
      const lng = Number(city.lng ?? city.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // Need snapped coords — re-resolve from countries tree.
      const snapCoords = resolveCityCoords(snapped.countryId, snapped.cityId);
      if (!snapCoords) return [];
      const d = haversineKm(snapCoords.lat, snapCoords.lng, lat, lng);
      if (d <= ALTERNATIVE_RADIUS_KM) {
        out.push({ countryId: country.id, cityId: city.id, name: city.name, distanceKm: d });
      }
    }
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, max);
}

// ─── URL invite detection ───────────────────────────────────────────────────
function readInviteParam() {
  try {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const params = new URLSearchParams(hash);
    const g = params.get('g');
    if (g) return g;
    const qp = new URLSearchParams(location.search);
    return qp.get('g') || null;
  } catch (_e) {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function renderGroupPanel(container) {
  if (!container) throw new Error('renderGroupPanel: container required');

  // Internal, ephemeral panel state.
  const ui = {
    computing: false,
    computeResult: null,      // { snapped, savedKmVsCentroid, alternatives:[] } | null
    computeError: null,       // string | null
    editingMemberId: null,    // '__new__' | memberId | null
    invited: false            // true when URL carried an incoming group
  };

  let abortCtrl = null;

  // Attempt to merge an incoming invite URL before first render.
  const invite = readInviteParam();
  if (invite) {
    try {
      const incoming = decodeGroupUrl(invite);
      const result = mergeIncomingGroup(incoming, null);
      if (result.action === 'conflict') {
        const accept = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(t('group.share.invitedTitle') + '\n\n' + t('group.share.invitedBody'))
          : true;
        if (accept) {
          // Force-adopt by clearing local group first, then re-merging.
          state.update('group', () => ({ members: [], leaderId: null, createdAt: null, groupCode: null }));
          mergeIncomingGroup(incoming, null);
          ui.invited = true;
        }
      } else if (result.action === 'adopted') {
        ui.invited = true;
      }
    } catch (err) {
      if (err && err.message === 'invalid-group-url') {
        showToast(t('group.errors.invalidUrl'), 'error');
      } else {
        console.warn('[group-plan-panel] invite decode failed', err);
      }
    }
  }

  // ─── Root scaffold ─────────────────────────────────────────────────────
  const root = h('div', { class: 'group-panel', 'data-page': 'group' });

  const headerSection = h('section', { class: 'group-panel__header', 'aria-labelledby': 'group-panel-title' });
  const membersSection = h('section', {
    class: 'group-panel__section group-panel__section--members',
    'aria-labelledby': 'group-panel-members-title',
    'aria-live': 'polite'
  });
  const meetingSection = h('section', {
    class: 'group-panel__section group-panel__section--meeting',
    'aria-labelledby': 'group-panel-meeting-title'
  });
  const itinerarySection = h('section', {
    class: 'group-panel__section group-panel__section--itinerary',
    'aria-labelledby': 'group-panel-itinerary-title'
  });
  const shareSection = h('section', {
    class: 'group-panel__section group-panel__section--share',
    'aria-labelledby': 'group-panel-share-title'
  });

  root.appendChild(headerSection);
  root.appendChild(membersSection);
  root.appendChild(meetingSection);
  root.appendChild(itinerarySection);
  root.appendChild(shareSection);

  empty(container);
  container.appendChild(root);

  // ─── Header ────────────────────────────────────────────────────────────
  function renderHeader() {
    empty(headerSection);
    const group = state.getSlice('group') || {};
    const hasGroup = !!group.groupCode && Array.isArray(group.members) && group.members.length > 0;

    headerSection.appendChild(h('h2', {
      id: 'group-panel-title',
      class: 'group-panel__title'
    }, t('group.panel.title') || 'Plan as a group'));

    headerSection.appendChild(h('p', {
      class: 'group-panel__subtitle'
    }, t('group.panel.subtitle') || 'Up to 10 friends, different home cities'));

    if (ui.invited) {
      headerSection.appendChild(h('div', {
        class: 'group-panel__invited-banner',
        role: 'status'
      }, [
        h('strong', null, t('group.share.invitedTitle') || "You've been invited"),
        h('span', null, ' — '),
        h('span', null, t('group.share.invitedBody') || 'Add yourself to the group below')
      ]));
    }

    if (!hasGroup) {
      const actions = h('div', { class: 'group-panel__header-actions' }, [
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          'data-action': 'create-group',
          onclick: handleCreateGroupClick
        }, t('group.panel.createBtn') || 'Create group'),
        h('button', {
          type: 'button',
          class: 'btn btn-ghost',
          'data-action': 'join-group',
          onclick: handleJoinGroupClick
        }, t('group.panel.joinBtn') || 'Join via link')
      ]);
      headerSection.appendChild(actions);
    } else {
      const badge = h('div', { class: 'group-panel__code-badge' }, [
        h('span', { class: 'group-panel__code-label' }, t('group.member.leaderBadge') ? '' : ''),
        h('code', { class: 'group-panel__code' }, group.groupCode)
      ]);
      const shareBtn = h('button', {
        type: 'button',
        class: 'btn btn-primary',
        'data-action': 'share-link',
        onclick: handleShareClick
      }, t('group.panel.shareBtn') || 'Share group link');
      headerSection.appendChild(h('div', { class: 'group-panel__header-actions' }, [badge, shareBtn]));
    }
  }

  // ─── Members ───────────────────────────────────────────────────────────
  function renderMembers() {
    empty(membersSection);
    const group = state.getSlice('group') || {};
    const members = Array.isArray(group.members) ? group.members : [];
    const leaderId = group.leaderId || null;
    const atCap = members.length >= GROUP_MAX_MEMBERS;

    const head = h('div', { class: 'group-panel__section-head' }, [
      h('h3', {
        id: 'group-panel-members-title',
        class: 'group-panel__section-title'
      }, t('group.member.add') || 'Members'),
      h('span', {
        class: 'group-panel__count-badge',
        'aria-label': `${members.length} / ${GROUP_MAX_MEMBERS}`
      }, `${members.length}/${GROUP_MAX_MEMBERS}`)
    ]);
    membersSection.appendChild(head);

    if (members.length === 0) {
      membersSection.appendChild(h('p', {
        class: 'group-panel__empty text-muted'
      }, t('group.panel.subtitle') || ''));
    }

    const list = h('ul', { class: 'group-member-list', role: 'list' });
    for (const m of members) {
      const isLeader = m.id === leaderId;
      const isEditing = ui.editingMemberId === m.id;
      const card = h('li', {
        class: 'group-member-card' + (isLeader ? ' group-member-card--leader' : ''),
        'data-member-id': m.id,
        tabindex: '0'
      });

      if (isEditing) {
        const formHost = h('div', { class: 'group-member-card__form' });
        card.appendChild(formHost);
        renderMemberForm(formHost, {
          member: m,
          onSubmit: (patched) => {
            try {
              addMember(patched);
              ui.editingMemberId = null;
              renderMembers();
            } catch (err) {
              handleMemberError(err);
            }
          },
          onCancel: () => {
            ui.editingMemberId = null;
            renderMembers();
          }
        });
      } else {
        const flag = flagEmoji(m.homeCountry);
        const cityName = cityLabel(m.homeCountry, m.homeCity);

        const info = h('div', { class: 'group-member-card__info' }, [
          h('span', { class: 'group-member-card__name' }, m.displayName || '—'),
          isLeader ? h('span', {
            class: 'group-member-card__leader-badge',
            'aria-label': t('group.member.leaderBadge') || 'Leader'
          }, [
            h('span', { 'aria-hidden': 'true' }, '★ '),
            h('span', null, t('group.member.leaderBadge') || 'Leader')
          ]) : null,
          h('span', { class: 'group-member-card__home' }, [
            flag ? h('span', { 'aria-hidden': 'true', class: 'group-member-card__flag' }, flag + ' ') : null,
            h('span', null, cityName)
          ])
        ]);

        const actions = h('div', { class: 'group-member-card__actions' }, [
          h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-icon',
            'data-action': 'edit-member',
            'data-member-id': m.id,
            'aria-label': `Edit ${m.displayName}`,
            onclick: () => { ui.editingMemberId = m.id; renderMembers(); }
          }, '✎'),
          isLeader ? null : h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-icon group-member-card__remove',
            'data-action': 'remove-member',
            'data-member-id': m.id,
            'aria-label': `${t('group.member.remove') || 'Remove'} ${m.displayName}`,
            onclick: () => handleRemoveClick(m.id)
          }, '×')
        ]);

        card.appendChild(info);
        card.appendChild(actions);

        // Keyboard: Enter to edit, Delete to remove (non-leader).
        card.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            ui.editingMemberId = m.id;
            renderMembers();
          } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !isLeader) {
            ev.preventDefault();
            handleRemoveClick(m.id);
          }
        });
      }

      list.appendChild(card);
    }

    // "New member" inline form row, or add button.
    if (ui.editingMemberId === '__new__') {
      const formHost = h('li', { class: 'group-member-card group-member-card--form' });
      renderMemberForm(formHost, {
        member: null,
        onSubmit: (patched) => {
          try {
            if (members.length === 0) {
              createGroup(patched);
            } else {
              addMember(patched);
            }
            ui.editingMemberId = null;
            renderMembers();
          } catch (err) {
            handleMemberError(err);
          }
        },
        onCancel: () => {
          ui.editingMemberId = null;
          renderMembers();
        }
      });
      list.appendChild(formHost);
    }

    membersSection.appendChild(list);

    if (atCap) {
      membersSection.appendChild(h('p', {
        class: 'group-panel__cap-warning',
        role: 'status'
      }, t('group.member.cap') || 'Maximum 10 members'));
    } else if (ui.editingMemberId !== '__new__') {
      const addBtn = h('button', {
        type: 'button',
        class: 'btn btn-secondary group-panel__add-member',
        'data-action': 'add-member',
        onclick: () => { ui.editingMemberId = '__new__'; renderMembers(); }
      }, '+ ' + (t('group.member.add') || 'Add member'));
      membersSection.appendChild(addBtn);
    }
  }

  // ─── Meeting point ─────────────────────────────────────────────────────
  function renderMeeting() {
    empty(meetingSection);
    const group = state.getSlice('group') || {};
    const members = Array.isArray(group.members) ? group.members : [];

    meetingSection.appendChild(h('h3', {
      id: 'group-panel-meeting-title',
      class: 'group-panel__section-title'
    }, t('group.meeting.title') || 'Suggested meeting point'));

    if (members.length < 2) {
      meetingSection.appendChild(h('p', { class: 'text-muted' },
        t('group.panel.subtitle') || 'Add at least 2 members to compute a meeting point.'));
      return;
    }

    const computeBtn = h('button', {
      type: 'button',
      class: 'btn btn-primary',
      'data-action': 'compute-meeting',
      disabled: ui.computing,
      onclick: handleComputeClick
    }, ui.computing
      ? (t('group.meeting.computing') || 'Optimizing…')
      : (t('group.meeting.optimize') || 'Compute optimal city'));
    meetingSection.appendChild(computeBtn);

    if (ui.computing) {
      meetingSection.appendChild(h('div', {
        class: 'group-panel__spinner',
        role: 'status',
        'aria-live': 'polite'
      }, t('group.meeting.computing') || 'Optimizing…'));
    }

    if (ui.computeError) {
      meetingSection.appendChild(h('p', {
        class: 'group-panel__error',
        role: 'alert'
      }, ui.computeError));
    }

    const res = ui.computeResult;
    if (res && res.snapped) {
      const { snapped, savedKmVsCentroid, alternatives } = res;
      const flag = flagEmoji(snapped.countryId);
      const savedKm = Math.max(0, Math.round(savedKmVsCentroid || 0));

      const card = h('div', { class: 'group-meeting-card', 'aria-live': 'polite' }, [
        h('div', { class: 'group-meeting-card__city' }, [
          flag ? h('span', { class: 'group-meeting-card__flag', 'aria-hidden': 'true' }, flag + ' ') : null,
          h('strong', null, snapped.cityName || snapped.cityId)
        ]),
        h('p', { class: 'group-meeting-card__saved' },
          t('group.meeting.savedKm', { km: savedKm }) || `Saves ${savedKm} km vs random meeting`)
      ]);
      meetingSection.appendChild(card);

      if (Array.isArray(alternatives) && alternatives.length > 0) {
        const altList = h('ul', { class: 'group-meeting-card__alternatives', role: 'list' });
        for (const alt of alternatives) {
          altList.appendChild(h('li', { class: 'group-meeting-card__alt' }, [
            h('span', { 'aria-hidden': 'true' }, flagEmoji(alt.countryId) + ' '),
            h('span', null, alt.name),
            h('span', { class: 'text-muted' }, ` · ${Math.round(alt.distanceKm)} km`)
          ]));
        }
        meetingSection.appendChild(h('div', { class: 'group-meeting-card__alt-wrap' }, [
          h('h4', { class: 'group-meeting-card__alt-heading' },
            t('group.meeting.alternative') || 'Alternatives'),
          altList
        ]));

        const voteBtn = h('button', {
          type: 'button',
          class: 'btn btn-secondary',
          'data-action': 'vote-meeting',
          onclick: handleVoteClick
        }, t('group.meeting.vote') || 'Vote on meeting point');
        meetingSection.appendChild(voteBtn);
      }
    }
  }

  // ─── Integrated itinerary ──────────────────────────────────────────────
  function renderItinerary() {
    empty(itinerarySection);
    const group = state.getSlice('group') || {};
    const members = Array.isArray(group.members) ? group.members : [];

    itinerarySection.appendChild(h('h3', {
      id: 'group-panel-itinerary-title',
      class: 'group-panel__section-title'
    }, t('group.itinerary.title') || 'Integrated itinerary'));

    const meeting = ui.computeResult?.snapped;
    if (!meeting) {
      itinerarySection.appendChild(h('p', { class: 'text-muted' },
        t('group.itinerary.shared') || 'Compute a meeting point to see per-member legs.'));
      return;
    }

    const mpCoords = resolveCityCoords(meeting.countryId, meeting.cityId);
    if (!mpCoords) {
      itinerarySection.appendChild(h('p', { class: 'group-panel__error', role: 'alert' },
        t('group.errors.invalidUrl') || 'Could not resolve meeting-point coordinates.'));
      return;
    }

    const list = h('ul', { class: 'group-itinerary-list', role: 'list' });
    for (const m of members) {
      const home = resolveCityCoords(m.homeCountry, m.homeCity);
      const rowLabel = t('group.itinerary.member', { name: m.displayName }) || `${m.displayName}'s leg`;
      if (!home) {
        list.appendChild(h('li', { class: 'group-itinerary-row' }, [
          h('span', { class: 'group-itinerary-row__name' }, rowLabel),
          h('span', { class: 'text-muted' }, '—')
        ]));
        continue;
      }
      const distKm = haversineKm(home.lat, home.lng, mpCoords.lat, mpCoords.lng);
      const co2 = estimateCo2Kg(distKm);
      list.appendChild(h('li', { class: 'group-itinerary-row' }, [
        h('span', { class: 'group-itinerary-row__name' }, rowLabel),
        h('span', { class: 'group-itinerary-row__metrics' }, [
          h('span', null, `${Math.round(distKm)} km`),
          h('span', { class: 'text-muted' }, ` · ~${co2} kg CO₂`)
        ])
      ]));
    }
    itinerarySection.appendChild(list);

    itinerarySection.appendChild(h('p', {
      class: 'group-itinerary-shared-note text-muted'
    }, t('group.itinerary.shared') || 'Shared section'));
  }

  // ─── Share footer ──────────────────────────────────────────────────────
  function renderShare() {
    empty(shareSection);
    const group = state.getSlice('group') || {};
    const members = Array.isArray(group.members) ? group.members : [];
    if (members.length === 0) return;

    shareSection.appendChild(h('h3', {
      id: 'group-panel-share-title',
      class: 'group-panel__section-title visually-hidden'
    }, t('group.panel.shareBtn') || 'Share'));

    const footer = h('div', { class: 'group-panel__share-footer' }, [
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        'data-action': 'share-link',
        onclick: handleShareClick
      }, t('group.panel.shareBtn') || 'Share group link')
    ]);
    shareSection.appendChild(footer);
  }

  // ─── Handlers ──────────────────────────────────────────────────────────
  function handleCreateGroupClick() {
    ui.editingMemberId = '__new__';
    renderMembers();
  }

  function handleJoinGroupClick() {
    const url = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt(t('group.panel.joinBtn') || 'Paste group link:')
      : null;
    if (!url) return;
    try {
      const m = url.match(/[?&#]g=([^&]+)/);
      const token = m ? decodeURIComponent(m[1]) : url;
      const incoming = decodeGroupUrl(token);
      const result = mergeIncomingGroup(incoming, null);
      if (result.action === 'conflict') {
        showToast(t('group.errors.invalidUrl') || 'Conflicting group', 'warning');
      } else {
        ui.invited = true;
        renderAll();
      }
    } catch (err) {
      showToast(t('group.errors.invalidUrl') || 'Invalid group link', 'error');
    }
  }

  function handleRemoveClick(memberId) {
    try {
      removeMember(memberId);
      renderMembers();
      renderItinerary();
    } catch (err) {
      handleMemberError(err);
    }
  }

  function handleMemberError(err) {
    const msg = err && err.message;
    if (msg === 'group-full') {
      showToast(t('group.errors.maxMembers') || 'Group is full', 'warning');
    } else if (msg === 'leader-cannot-leave') {
      const warn = h('p', {
        class: 'group-panel__inline-warning',
        role: 'alert'
      }, t('group.member.leaderBadge') ? `${t('group.member.leaderBadge')}: cannot leave without transferring leadership.` : 'Leader cannot leave.');
      // Insert at top of members section briefly.
      membersSection.insertBefore(warn, membersSection.firstChild);
      setTimeout(() => warn.remove(), 4000);
    } else {
      console.warn('[group-plan-panel] member op failed', err);
      showToast(String(msg || 'Error'), 'error');
    }
  }

  async function handleComputeClick() {
    if (ui.computing) return;
    ui.computing = true;
    ui.computeError = null;
    ui.computeResult = null;
    renderMeeting();

    if (abortCtrl) abortCtrl.abort();
    abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const signal = abortCtrl ? abortCtrl.signal : undefined;

    try {
      const result = await computeOptimalMeetingPoint({ signal });
      if (signal && signal.aborted) return;
      const countries = state.getSlice('countries') || [];
      const alternatives = findAlternatives(result.snapped, countries, 2);
      ui.computeResult = {
        snapped: result.snapped,
        savedKmVsCentroid: result.savedKmVsCentroid,
        alternatives
      };
    } catch (err) {
      if (err && err.message === 'aborted') return;
      console.warn('[group-plan-panel] compute failed', err);
      ui.computeError = String(err?.message || err || 'compute-failed');
    } finally {
      ui.computing = false;
      renderMeeting();
      renderItinerary();
    }
  }

  async function handleShareClick() {
    try {
      const compressed = encodeGroupUrl();
      const url = `${location.origin}${location.pathname}${location.search}#/group?g=${compressed}`;
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(url); copied = true; } catch (_e) { /* noop */ }
      }
      showToast(
        copied ? (t('group.panel.linkCopied') || 'Link copied') : url,
        copied ? 'success' : 'info'
      );
    } catch (err) {
      if (err && err.message === 'group-url-too-long') {
        // Inline error with remediation hint.
        const existing = shareSection.querySelector('.group-panel__url-long');
        if (!existing) {
          shareSection.appendChild(h('p', {
            class: 'group-panel__error group-panel__url-long',
            role: 'alert'
          }, t('group.share.urlLong') || 'Link too long — try fewer members or shorter preferences'));
        }
      } else {
        showToast(t('group.errors.invalidUrl') || 'Share failed', 'error');
      }
    }
  }

  async function handleVoteClick() {
    const res = ui.computeResult;
    if (!res || !res.snapped) return;
    const candidates = [
      { countryId: res.snapped.countryId, cityId: res.snapped.cityId, label: res.snapped.cityName },
      ...((res.alternatives || []).map(a => ({ countryId: a.countryId, cityId: a.cityId, label: a.name })))
    ].slice(0, 3);
    try {
      const mod = await import('../features/group-vote.js');
      if (typeof mod.createBallot === 'function') {
        const stops = candidates.map(c => ({ countryId: c.countryId, cityId: c.cityId }));
        const { copied, url } = await mod.createBallot(stops);
        showToast(
          copied ? (t('group.panel.linkCopied') || 'Vote link copied') : url,
          copied ? 'success' : 'info'
        );
      }
    } catch (err) {
      console.warn('[group-plan-panel] vote launch failed', err);
      showToast(t('group.errors.invalidUrl') || 'Vote failed', 'error');
    }
  }

  // ─── Full render + subscribe ───────────────────────────────────────────
  function renderAll() {
    renderHeader();
    renderMembers();
    renderMeeting();
    renderItinerary();
    renderShare();
  }

  renderAll();

  // Re-render on state.group change. Any in-flight edit-form keeps its
  // local state — we only touch sections that depend on the slice.
  const unsubscribe = state.subscribe('group', () => {
    renderHeader();
    // Don't clobber an open edit form via full remount.
    if (ui.editingMemberId === null) renderMembers();
    renderShare();
  });

  // ─── Cleanup ───────────────────────────────────────────────────────────
  return function cleanup() {
    try { unsubscribe(); } catch (_e) { /* noop */ }
    if (abortCtrl) { try { abortCtrl.abort(); } catch (_e) { /* noop */ } }
    empty(container);
  };
}

// Keep unused import `on` tree-shake-friendly — referenced to avoid linter noise.
void on;
