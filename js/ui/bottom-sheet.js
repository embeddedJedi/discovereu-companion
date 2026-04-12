// js/ui/bottom-sheet.js
// Reusable touch-drag bottom sheet with three snap states.
// Usage:
//   const sheet = createBottomSheet();
//   document.body.appendChild(sheet.el);
//   sheet.open(contentEl, 'peek');
//   sheet.close();
//   sheet.destroy();

import { h, on } from '../utils/dom.js';

const STATES = { closed: 100, peek: 70, half: 50, full: 15 }; // % from top
const VELOCITY_THRESHOLD = 0.5; // px/ms — fast swipe snaps to next state
const SNAP_ORDER = ['closed', 'peek', 'half', 'full'];

export function createBottomSheet() {
  let currentState = 'closed';
  let dragStartY = 0;
  let dragStartPercent = 0;
  let dragStartTime = 0;
  let isDragging = false;
  const listeners = new Set();

  // DOM structure
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const handle = h('div', { class: 'sheet-handle', 'aria-hidden': 'true' },
    [h('div', { class: 'sheet-handle-bar' })]
  );
  const contentArea = h('div', { class: 'sheet-content' });
  const sheet = h('div', {
    class: 'sheet',
    role: 'dialog',
    'aria-modal': 'false',
    style: { transform: `translateY(${STATES.closed}%)` }
  }, [handle, contentArea]);

  const el = h('div', { class: 'sheet-container', dataset: { state: 'closed' } }, [backdrop, sheet]);

  // Position helpers
  function setPercent(pct, animate = true) {
    if (animate) {
      sheet.style.transition = `transform var(--duration-sheet) var(--ease-spring)`;
    } else {
      sheet.style.transition = 'none';
    }
    sheet.style.transform = `translateY(${pct}%)`;
  }

  function snapTo(state, animate = true) {
    currentState = state;
    el.dataset.state = state;
    setPercent(STATES[state], animate);
    backdrop.style.opacity = state === 'closed' ? '0' : '1';
    backdrop.style.pointerEvents = state === 'closed' ? 'none' : 'auto';
    if (state === 'closed') {
      setTimeout(() => { contentArea.innerHTML = ''; }, 300);
    }
    listeners.forEach(cb => cb(state));
  }

  // Drag handling
  function onPointerDown(ev) {
    if (!ev.target.closest('.sheet-handle')) return;
    isDragging = true;
    dragStartY = ev.clientY;
    dragStartPercent = STATES[currentState];
    dragStartTime = Date.now();
    sheet.style.transition = 'none';
    sheet.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!isDragging) return;
    const dy = ev.clientY - dragStartY;
    const dpct = (dy / window.innerHeight) * 100;
    const newPct = Math.max(STATES.full, Math.min(STATES.closed, dragStartPercent + dpct));
    sheet.style.transform = `translateY(${newPct}%)`;
  }

  function onPointerUp(ev) {
    if (!isDragging) return;
    isDragging = false;
    const dy = ev.clientY - dragStartY;
    const dt = Date.now() - dragStartTime;
    const velocity = dy / dt; // px/ms, positive = downward
    const currentPct = dragStartPercent + (dy / window.innerHeight) * 100;

    let target;
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      // Fast swipe: go to next state in swipe direction
      const idx = SNAP_ORDER.indexOf(currentState);
      target = velocity > 0
        ? SNAP_ORDER[Math.max(0, idx - 1)]    // swipe down → smaller
        : SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, idx + 1)]; // swipe up → bigger
    } else {
      // Slow drag: snap to nearest state
      target = SNAP_ORDER.reduce((best, s) =>
        Math.abs(STATES[s] - currentPct) < Math.abs(STATES[best] - currentPct) ? s : best
      );
    }
    snapTo(target);
  }

  sheet.addEventListener('pointerdown', onPointerDown);
  sheet.addEventListener('pointermove', onPointerMove);
  sheet.addEventListener('pointerup', onPointerUp);

  // Backdrop click closes
  backdrop.addEventListener('click', () => snapTo('closed'));

  // Keyboard: Escape closes
  function onKeydown(ev) {
    if (ev.key === 'Escape' && currentState !== 'closed') {
      snapTo('closed');
      ev.stopPropagation();
    }
  }
  document.addEventListener('keydown', onKeydown);

  return {
    el,
    open(content, initialState = 'peek') {
      contentArea.innerHTML = '';
      if (typeof content === 'string') {
        contentArea.innerHTML = content;
      } else if (content instanceof Node) {
        contentArea.appendChild(content);
      }
      // Force closed first, then animate to target
      snapTo('closed', false);
      requestAnimationFrame(() => requestAnimationFrame(() => snapTo(initialState)));
    },
    close() { snapTo('closed'); },
    getState() { return currentState; },
    onStateChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    destroy() {
      document.removeEventListener('keydown', onKeydown);
      el.remove();
    }
  };
}
