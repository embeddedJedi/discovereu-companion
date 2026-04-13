// js/ui/impact-panel.js
// v1.4 Impact Dashboard — in-app panel.
//
// Renders the user's personal impact summary: a 4-axis radar chart
// (Green / Inclusion / Participation / Digital), a 2x2/4x1 stats grid,
// export buttons (PNG post, PNG story, JSON), and an opt-in toggle for
// contributing anonymous aggregate metrics to the public dashboard.
//
// Pure UI: all compute comes from js/features/impact-compute.js, all
// card rendering from js/features/impact-card.js. This module subscribes
// to state.route / state.user / state.impact / state.a11y / state.bingo
// and re-renders on change; renderImpactPanel() returns an unsubscribe
// cleanup function.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty, on } from '../utils/dom.js';
import { computeImpact } from '../features/impact-compute.js';
import { exportImpactCard } from '../features/impact-card.js';
import { showToast } from './toast.js';

// Score derivation (0-100 per axis).
function deriveScores(personal, a11y) {
  const p = personal || {};
  const green = clamp100((Math.max(0, p.co2Saved || 0) / 200) * 100);

  // Inclusion: base 40 if the user has any non-default a11y setting,
  // plus 10 per recorded a11y feature usage.
  const a11yConfigured = a11y && (
    a11y.dyslexiaMode || a11y.lowBandwidth || a11y.highContrast ||
    a11y.reduceMotion !== null || a11y.fontScale !== 1.0 ||
    a11y.lineHeight !== 1.5 || a11y.letterSpacing !== 0 ||
    (a11y.colorBlindMode && a11y.colorBlindMode !== 'none') ||
    a11y.transcribeVoice
  );
  const used = Array.isArray(p.a11yFeaturesUsed) ? p.a11yFeaturesUsed.length : 0;
  const inclusion = clamp100((a11yConfigured ? 40 : 0) + used * 10);

  const participation = clamp100(20 * (p.bingoCompleted || 0));
  const digital = clamp100((p.countriesVisited || 0) * 15);

  return { green, inclusion, participation, digital };
}

function clamp100(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getCssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback || '';
}

// Keep a module-scoped reference so we can destroy across re-renders,
// otherwise Chart.js leaks canvas contexts.
let _radarChart = null;

function drawRadar(canvas, scores) {
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    setTimeout(() => drawRadar(canvas, scores), 120);
    return;
  }
  try { if (_radarChart) _radarChart.destroy(); } catch (_) { /* noop */ }

  const labels = [
    t('impact.axes.green'),
    t('impact.axes.inclusion'),
    t('impact.axes.participation'),
    t('impact.axes.digital')
  ];
  const data = [scores.green, scores.inclusion, scores.participation, scores.digital];

  const textColor = getCssVar('--text-secondary', '#5b6479');
  const gridColor = getCssVar('--border-subtle', 'rgba(120,128,150,0.3)');
  const accent = getCssVar('--accent', '#0057b7');

  const prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  _radarChart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: t('impact.panel.title'),
        data,
        borderColor: accent,
        backgroundColor: hexToRgba(accent, 0.2),
        borderWidth: 2,
        pointBackgroundColor: accent,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: prefersReduced ? false : { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { stepSize: 25, backdropColor: 'transparent', color: textColor },
          angleLines: { color: gridColor },
          grid:       { color: gridColor },
          pointLabels: { color: textColor, font: { size: 12 } }
        }
      }
    }
  });
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0, 87, 183, ${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatNumber(n) {
  const locale = state.getSlice('language') === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.NumberFormat(locale).format(Math.round(n || 0));
}

function buildStatsGrid(personal) {
  const p = personal || {};
  const cells = [
    { key: 'countries', value: p.countriesVisited || 0,    priority: 'digital' },
    { key: 'km',        value: p.totalKm || 0,             priority: 'green' },
    { key: 'co2',       value: p.co2Saved || 0,            priority: 'green' },
    { key: 'spend',     value: p.estimatedLocalSpend || 0, priority: 'inclusion' }
  ];
  return h('div', {
    class: 'impact-stats',
    role: 'group',
    'aria-label': t('impact.panel.subtitle'),
    'aria-live': 'polite'
  }, cells.map(c =>
    h('div', {
      class: 'impact-stat card',
      'data-grant-priority': c.priority
    }, [
      h('div', { class: 'impact-stat-value' }, formatNumber(c.value)),
      h('div', { class: 'impact-stat-label text-muted' }, t('impact.stat.' + c.key))
    ])
  ));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function tryLoadJsonExport() {
  try {
    const mod = await import('../features/impact-export.js');
    if (mod && typeof mod.exportContributionJson === 'function') {
      return mod.exportContributionJson;
    }
    if (mod && typeof mod.default === 'function') return mod.default;
  } catch (_) { /* module absent - expected until task 9 */ }
  return null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildExportSection(getSnapshot) {
  const cardBtn = h('button', {
    class: 'btn btn-primary impact-export-btn',
    type: 'button'
  }, t('impact.export.card'));

  on(cardBtn, 'click', async () => {
    cardBtn.disabled = true;
    try {
      const snapshot = await getSnapshot();
      const blob = await exportImpactCard({ format: 'png', size: 'post', snapshot });
      triggerDownload(blob, `discovereu-impact-post-${todayIso()}.png`);
    } catch (e) {
      console.warn('[impact-panel] export card failed', e);
      showToast({ message: String(e && e.message || e), variant: 'danger' });
    } finally { cardBtn.disabled = false; }
  });

  const storyBtn = h('button', {
    class: 'btn btn-secondary impact-export-btn',
    type: 'button'
  }, t('impact.export.story'));

  on(storyBtn, 'click', async () => {
    storyBtn.disabled = true;
    try {
      const snapshot = await getSnapshot();
      const blob = await exportImpactCard({ format: 'png', size: 'story', snapshot });
      triggerDownload(blob, `discovereu-impact-story-${todayIso()}.png`);
    } catch (e) {
      console.warn('[impact-panel] export story failed', e);
      showToast({ message: String(e && e.message || e), variant: 'danger' });
    } finally { storyBtn.disabled = false; }
  });

  const jsonBtn = h('button', {
    class: 'btn btn-ghost impact-export-btn',
    type: 'button',
    disabled: true,
    'aria-disabled': 'true',
    title: t('impact.export.jsonUnavailable')
  }, t('impact.export.json'));

  // Opportunistically enable JSON export if the module is present.
  tryLoadJsonExport().then(fn => {
    if (!fn) return;
    jsonBtn.disabled = false;
    jsonBtn.removeAttribute('aria-disabled');
    jsonBtn.removeAttribute('title');
    on(jsonBtn, 'click', async () => {
      jsonBtn.disabled = true;
      try {
        const snapshot = await getSnapshot();
        const result = await fn(snapshot);
        // Caller module may either return a Blob or handle download itself.
        if (result instanceof Blob) {
          triggerDownload(result, `discovereu-impact-${todayIso()}.json`);
        }
      } catch (e) {
        console.warn('[impact-panel] export json failed', e);
        showToast({ message: String(e && e.message || e), variant: 'danger' });
      } finally { jsonBtn.disabled = false; }
    });
  });

  return h('div', { class: 'impact-exports' }, [cardBtn, storyBtn, jsonBtn]);
}

function buildOptInCard() {
  const current = !!(state.getSlice('impact') && state.getSlice('impact').aggregateOptIn);
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    id: 'impact-optin-toggle',
    class: 'impact-optin-input',
    'aria-checked': current ? 'true' : 'false'
  });
  if (current) input.checked = true;

  on(input, 'change', () => {
    const next = !!input.checked;
    input.setAttribute('aria-checked', next ? 'true' : 'false');
    state.update('impact', (prev) => ({ ...(prev || {}), aggregateOptIn: next }));
  });

  return h('section', { class: 'card impact-optin' }, [
    h('label', { class: 'impact-optin-label', for: 'impact-optin-toggle' }, [
      input,
      h('span', null, t('impact.optIn.label'))
    ]),
    h('ul', { class: 'impact-optin-bullets text-muted small' }, [
      h('li', null, t('impact.optIn.what')),
      h('li', null, t('impact.optIn.notShared')),
      h('li', null, t('impact.optIn.location'))
    ])
  ]);
}

function buildPublicLink() {
  return h('p', { class: 'impact-public-link' }, [
    h('a', {
      href: '/impact.html',
      target: '_blank',
      rel: 'noopener noreferrer'
    }, t('impact.public.link'))
  ]);
}

/**
 * Render the in-app Impact panel into `container`.
 *
 * Subscribes to state slices that influence the computed impact
 * (`route`, `user`, `impact`, `a11y`, `bingo`, `language`) and
 * re-renders on change.
 *
 * @param {HTMLElement} container Host element (will be emptied).
 * @returns {() => void} Cleanup: unsubscribes and destroys the radar.
 */
export function renderImpactPanel(container) {
  if (!container) return () => {};

  let cancelled = false;
  let latestSnapshot = null;
  let pendingRender = false;

  async function render() {
    if (cancelled) return;
    if (pendingRender) return;
    pendingRender = true;
    try {
      const snapshot = await computeImpact();
      if (cancelled) return;
      latestSnapshot = snapshot;
      paint(snapshot);
    } catch (e) {
      console.warn('[impact-panel] compute failed', e);
    } finally {
      pendingRender = false;
    }
  }

  function paint(snapshot) {
    empty(container);
    container.classList.add('impact-panel');

    const scores = deriveScores(snapshot.personal, state.getSlice('a11y'));

    // Header
    container.appendChild(h('header', { class: 'impact-panel-header' }, [
      h('h2', { class: 'impact-panel-title' }, t('impact.panel.title')),
      h('p', { class: 'impact-panel-subtitle text-muted' }, t('impact.panel.subtitle'))
    ]));

    // Radar
    const radarAlt = t('impact.radar.alt', scores);
    const canvas = h('canvas', {
      id: 'impact-radar',
      role: 'img',
      'aria-label': radarAlt,
      width: 400,
      height: 400
    });
    container.appendChild(h('div', { class: 'impact-radar-wrap' }, [canvas]));

    // Stats grid
    container.appendChild(buildStatsGrid(snapshot.personal));

    // Exports
    container.appendChild(buildExportSection(
      async () => latestSnapshot || await computeImpact()
    ));

    // Opt-in
    container.appendChild(buildOptInCard());

    // Public dashboard link
    container.appendChild(buildPublicLink());

    // Draw radar after the canvas is in the DOM so Chart.js sees layout.
    requestAnimationFrame(() => drawRadar(canvas, scores));
  }

  // Initial paint.
  render();

  // Subscribe to slices that affect computed impact or UI strings.
  const unsubs = [
    state.subscribe('route',    () => render()),
    state.subscribe('user',     () => render()),
    state.subscribe('impact',   () => render()),
    state.subscribe('a11y',     () => render()),
    state.subscribe('bingo',    () => render()),
    state.subscribe('language', () => render())
  ];

  return function cleanup() {
    cancelled = true;
    unsubs.forEach(u => { try { u(); } catch (_) { /* noop */ } });
    try { if (_radarChart) { _radarChart.destroy(); _radarChart = null; } } catch (_) { /* noop */ }
  };
}

/**
 * Spec alias: the plan names a `refreshImpactPanel()` helper. Exposed
 * for external callers that want to force a re-render (e.g. after a
 * locale switch); internally the subscribe-based loop covers most cases.
 *
 * @param {HTMLElement} container
 * @returns {() => void}
 */
export function refreshImpactPanel(container) {
  return renderImpactPanel(container);
}
