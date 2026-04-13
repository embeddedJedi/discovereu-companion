// js/pages/impact.js
// v1.4 — thin page wrapper that mounts the in-app Impact Dashboard into
// the SPA page-root container. Delegates all rendering and subscription
// bookkeeping to js/ui/impact-panel.js.

import { renderImpactPanel } from '../ui/impact-panel.js';

let cleanup = null;

export async function mount(container) {
  if (!container) return;
  // Ensure the host element uses the impact stylesheet layout.
  container.classList.add('impact-page-host');
  cleanup = renderImpactPanel(container);
}

export function unmount() {
  try { if (typeof cleanup === 'function') cleanup(); } catch (_) { /* noop */ }
  cleanup = null;
}
