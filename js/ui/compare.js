// js/ui/compare.js
// Compare tab — radar chart over 2-4 countries.
//
// Countries are added via the detail-panel "Compare" button, which pushes
// into state.compare. We reuse a single Chart.js instance and tear it down
// between renders to avoid memory leaks when the tab is re-entered.
//
// Chart.js is loaded as a CDN script with `defer`; by the time the user
// opens the Compare tab it's almost always ready, but we still guard for
// the race on first load.

/* global Chart */

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';

const AXES = ['nature', 'culture', 'nightlife', 'food', 'budgetFriendly', 'accessibility'];

// Deterministic palette so re-renders don't flicker. First entry is the
// primary accent; the rest follow the EU gold / green / red pattern.
const PALETTE = [
  { stroke: '#2a47c2', fill: 'rgba(42,71,194,0.18)' },
  { stroke: '#f4b400', fill: 'rgba(244,180,0,0.18)' },
  { stroke: '#0f9d58', fill: 'rgba(15,157,88,0.18)' },
  { stroke: '#d93025', fill: 'rgba(217,48,37,0.18)' }
];

let chart = null;

export function initCompare() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = () => {
    if (state.getSlice('panelTab') !== 'compare') {
      // Tab switched away — dispose Chart.js so its canvas isn't orphaned.
      if (chart) { chart.destroy(); chart = null; }
      return;
    }
    renderInto(body);
  };

  state.subscribe('panelTab',  render);
  state.subscribe('compare',   render);
  state.subscribe('countries', render);
  state.subscribe('language',  render);

  render();
}

function renderInto(root) {
  // Dispose any previous chart instance tied to the old canvas.
  if (chart) { chart.destroy(); chart = null; }
  empty(root);

  const ids = state.getSlice('compare') || [];
  const countries = ids.map(id => countryById(id)).filter(Boolean);

  const panel = h('div', { class: 'compare-panel' }, [
    h('header', { class: 'compare-header' }, [
      h('h2', { class: 'compare-title' }, t('compare.title')),
      h('p', { class: 'compare-hint' }, t('compare.hint'))
    ]),
    countries.length === 0
      ? renderEmptyState()
      : renderChartArea(countries)
  ]);

  root.appendChild(panel);
  wireActions(panel);

  if (countries.length > 0) {
    drawChart(panel.querySelector('#compareChart'), countries);
  }
}

function renderEmptyState() {
  return h('div', { class: 'alert alert-info' }, [
    h('span', null, t('compare.empty'))
  ]);
}

function renderChartArea(countries) {
  const chips = countries.map((c, i) => h('span', {
    class: 'compare-chip',
    style: { borderColor: PALETTE[i % PALETTE.length].stroke }
  }, [
    h('span', { class: 'compare-swatch',
                style: { background: PALETTE[i % PALETTE.length].stroke } }),
    h('span', null, `${c.flag || ''} ${c.name}`),
    h('button', {
      class: 'compare-chip-remove',
      type: 'button',
      'aria-label': t('compare.remove', { country: c.name }),
      'data-action': 'remove-compare',
      'data-country-id': c.id
    }, '×')
  ]));

  return h('section', { class: 'compare-chart-section' }, [
    h('div', { class: 'compare-chip-row' }, chips),
    h('div', { class: 'compare-chart-wrap' }, [
      h('canvas', { id: 'compareChart', 'aria-label': t('compare.title') })
    ]),
    h('div', { class: 'compare-actions' }, [
      h('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        'data-action': 'clear-compare'
      }, t('compare.clear'))
    ])
  ]);
}

function drawChart(canvas, countries) {
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    // Chart.js still loading — retry once the script defer-resolves.
    setTimeout(() => drawChart(canvas, countries), 120);
    return;
  }

  const labels = AXES.map(a => t(`compare.axes.${a}`));

  const datasets = countries.map((c, i) => {
    const palette = PALETTE[i % PALETTE.length];
    return {
      label: c.name,
      data: AXES.map(axis => c.scores?.[axis] ?? 0),
      borderColor: palette.stroke,
      backgroundColor: palette.fill,
      borderWidth: 2,
      pointBackgroundColor: palette.stroke,
      pointRadius: 3
    };
  });

  const textColor = getCssVar('--text-secondary') || '#5b6479';
  const gridColor = getCssVar('--border-subtle') || 'rgba(120,128,150,0.3)';

  chart = new Chart(canvas, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { size: 12 } }
        },
        tooltip: { enabled: true }
      },
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 5,
          ticks: { stepSize: 1, backdropColor: 'transparent', color: textColor },
          angleLines: { color: gridColor },
          grid:       { color: gridColor },
          pointLabels: { color: textColor, font: { size: 11 } }
        }
      }
    }
  });
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function wireActions(panel) {
  on(panel, 'click', '[data-action="remove-compare"]', (_ev, target) => {
    const id = target.dataset.countryId;
    state.update('compare', list => (list || []).filter(x => x !== id));
  });
  on(panel, 'click', '[data-action="clear-compare"]', () => {
    state.set('compare', []);
  });
}
