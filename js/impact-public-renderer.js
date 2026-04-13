/**
 * impact-public-renderer.js
 *
 * Progressive-enhancement layer for pages/impact.html.
 * - Fetches ../data/impact-public.json (CC-BY-4.0 anonymised aggregate).
 * - Renders a Chart.js bar (trips, countries, CO2 saved kg, km) and a
 *   donut (a11yFeatureAdoption) into #interactive.
 * - Preserves the static FROZEN block above #interactive.
 * - On error, writes a static fallback note (no innerHTML interpolation).
 */

const CHART_COLORS = [
  'rgba(37, 99, 235, 0.75)',   // blue
  'rgba(16, 185, 129, 0.75)',  // green
  'rgba(245, 158, 11, 0.75)',  // gold
  'rgba(139, 92, 246, 0.75)',  // violet
  'rgba(239, 68, 68, 0.75)',   // red
  'rgba(14, 165, 233, 0.75)'   // sky
];

/** Safely create element with text content (no HTML interpolation). */
function h(tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  if (text != null) el.textContent = String(text);
  return el;
}

/** Wait for Chart.js (loaded via <script defer>). */
function whenChartReady(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (typeof window.Chart !== 'undefined') return resolve(window.Chart);
      if (Date.now() - start > timeoutMs) return reject(new Error('Chart.js failed to load'));
      setTimeout(poll, 50);
    })();
  });
}

function renderFallback(root) {
  root.replaceChildren();
  const p = h('p', { class: 'note' }, 'Interactive view unavailable — showing static totals above.');
  root.appendChild(p);
  root.setAttribute('aria-busy', 'false');
}

function buildHeading(text) {
  return h('h2', {}, text);
}

function buildChartCard(titleText, canvasId) {
  const wrap = h('div', { class: 'impact-chart-wrap' });
  wrap.appendChild(h('h3', {}, titleText));
  const canvas = h('canvas', { id: canvasId, role: 'img' });
  wrap.appendChild(canvas);
  return { wrap, canvas };
}

function buildMetricAttr(value, priority) {
  // Invisible element used for grant-priority auditing (spec §10).
  const span = h('span', {}, String(value));
  span.setAttribute('data-grant-priority', priority);
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  return span;
}

async function render() {
  const root = document.getElementById('interactive');
  if (!root) return;

  let data;
  try {
    const res = await fetch('../data/impact-public.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    // Network or missing file — keep FROZEN block, show note in #interactive.
    console.warn('[impact] aggregate load failed:', err);
    renderFallback(root);
    return;
  }

  let Chart;
  try {
    Chart = await whenChartReady();
  } catch (err) {
    console.warn('[impact] Chart.js not ready:', err);
    renderFallback(root);
    return;
  }

  const totals = (data && data.totals) || {};
  const trips = Number(totals.trips ?? totals.tripsPlanned ?? 0);
  const countries = Number(totals.countries ?? 0);
  const co2Saved = Number(totals.co2Saved ?? totals.co2SavedKg ?? 0);
  const km = Number(totals.km ?? totals.kmTravelled ?? 0);
  const adoption = (data && (data.a11yFeatureAdoption || (data.distributions && data.distributions.a11yFeatureAdoption))) || {};
  const contributors = Number(data.totalContributors ?? 0);

  try {
    root.replaceChildren();
    root.appendChild(buildHeading('Community aggregate'));

    // Hidden grant-priority anchors so audits can still find the live values.
    root.appendChild(buildMetricAttr(trips, 'green'));
    root.appendChild(buildMetricAttr(countries, 'green'));
    root.appendChild(buildMetricAttr(co2Saved, 'green'));
    root.appendChild(buildMetricAttr(Object.keys(adoption).length, 'digital'));
    root.appendChild(buildMetricAttr(contributors, 'participation'));

    const charts = h('div', { class: 'impact-charts' });
    const { wrap: barWrap, canvas: barCanvas } = buildChartCard('Totals', 'impact-bar');
    const { wrap: donutWrap, canvas: donutCanvas } = buildChartCard('Accessibility feature adoption', 'impact-donut');
    charts.appendChild(barWrap);
    charts.appendChild(donutWrap);
    root.appendChild(charts);

    new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Trips', 'Countries', 'CO2 saved (kg)', 'Kilometres'],
        datasets: [{
          label: 'Community totals',
          data: [trips, countries, Math.round(co2Saved), Math.round(km)],
          backgroundColor: CHART_COLORS.slice(0, 4),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    const donutLabels = Object.keys(adoption);
    const donutValues = donutLabels.map((k) => Number(adoption[k] || 0));
    const donutHasData = donutValues.some((v) => v > 0);

    if (donutHasData) {
      new Chart(donutCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: donutLabels,
          datasets: [{
            data: donutValues,
            backgroundColor: donutLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { enabled: true }
          }
        }
      });
    } else {
      donutWrap.appendChild(h('p', { class: 'note' }, 'Not enough data to show accessibility adoption yet.'));
    }

    const meta = h('p', { class: 'note' },
      `Based on ${contributors} anonymised contributor snapshot(s). k>=${data.kFloor ?? 5}. License: ${data.license ?? 'CC-BY-4.0'}.`);
    root.appendChild(meta);

    root.setAttribute('aria-busy', 'false');
  } catch (err) {
    console.warn('[impact] render failed:', err);
    renderFallback(root);
  }
}

render();
