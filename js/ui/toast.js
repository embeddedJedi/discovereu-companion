// js/ui/toast.js
// Dead-simple toast notifications. Stacks vertically in a fixed container,
// auto-dismisses after 3s. The existing `.toast-container` / `.toast`
// styles in css/components.css already cover the visuals.

import { h, qs } from '../utils/dom.js';

const CONTAINER_ID = 'toastContainer';
const DURATION_MS = 3000;

function ensureContainer() {
  let root = qs('#' + CONTAINER_ID);
  if (!root) {
    root = h('div', { id: CONTAINER_ID, class: 'toast-container', 'aria-live': 'polite' });
    document.body.appendChild(root);
  }
  return root;
}

export function showToast(message, variant = 'info') {
  const root = ensureContainer();
  const node = h('div', { class: `toast toast-${variant}`, role: 'status' }, message);
  root.appendChild(node);

  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateX(16px)';
    setTimeout(() => node.remove(), 250);
  }, DURATION_MS);
}
