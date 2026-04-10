// js/utils/dom.js
// Tiny DOM helpers. No jQuery, no framework.

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * Create an element with attributes and children.
 *   h('div', { class: 'card', 'data-id': 'de' }, [h('h2', null, 'Germany')])
 */
export function h(tag, attrs = null, children = null) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset' && typeof value === 'object') {
        for (const [dk, dv] of Object.entries(value)) el.dataset[dk] = dv;
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  if (children != null) append(el, children);
  return el;
}

function append(parent, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) { child.forEach(c => append(parent, c)); return; }
  if (child instanceof Node) { parent.appendChild(child); return; }
  parent.appendChild(document.createTextNode(String(child)));
}

/**
 * Delegated event listener.
 *   on(container, 'click', '.route-stop-remove', (ev, target) => ...)
 */
export function on(root, event, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === 'function') {
    root.addEventListener(event, selectorOrHandler);
    return () => root.removeEventListener(event, selectorOrHandler);
  }
  const selector = selectorOrHandler;
  const handler = maybeHandler;
  const delegated = (ev) => {
    const target = ev.target.closest(selector);
    if (target && root.contains(target)) handler(ev, target);
  };
  root.addEventListener(event, delegated);
  return () => root.removeEventListener(event, delegated);
}

/** Toggle an attribute-based open/close state. */
export function setOpen(el, open) {
  el.setAttribute('data-open', open ? 'true' : 'false');
}

/** Clear all children efficiently. */
export function empty(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Escape a string for safe HTML interpolation. */
export function escape(str) {
  const s = String(str);
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
