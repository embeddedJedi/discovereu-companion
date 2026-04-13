// js/ui/a11y-panel.js
// v1.5 Accessibility Overlay — settings panel rendered under /more → Accessibility.
//
// Exposes all `state.a11y` controls: dyslexia font toggle, font scale / line-height /
// letter-spacing segmented radio groups, reduce-motion tri-state, high-contrast toggle,
// color-blind mode radios, voice transcription toggle (lazy ~40 MB model), and
// low-bandwidth toggle. Every control is keyboard-accessible (Space for toggles,
// arrow keys for radio groups — native browser behavior on `<input type="radio">`
// inside the same `name` group) and bound directly to `state.update('a11y', ...)`.
//
// Pure UI module — no DOM side effects outside the supplied container. The applier
// (js/features/a11y-settings.js) reacts to state changes and writes
// <html data-a11y-*> attributes; this panel never touches the root element.
//
// API:
//   renderA11yPanel(container) → cleanup()
//   renderA11ySection()        → returns detached element (smoke-test helper)

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

const FONT_SCALES   = [0.85, 1.0, 1.25, 1.5];
const LINE_HEIGHTS  = [1.5, 1.8, 2.0];
const LETTER_SPACES = [0, 0.05, 0.1];
const COLOR_BLIND   = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];

let panelSeq = 0;

/**
 * Render the accessibility panel into `container`. Subscribes to `state.a11y`
 * so external changes (e.g. system-theme-driven) re-render the current values.
 * Returns a cleanup function that removes listeners and clears the container.
 */
export function renderA11yPanel(container) {
  if (!container) return () => {};
  const uid = `a11y-${++panelSeq}`;
  let unsubscribe = () => {};

  const paint = () => {
    empty(container);
    container.appendChild(build(uid));
  };

  paint();
  unsubscribe = state.subscribe('a11y', paint);

  return () => {
    try { unsubscribe(); } catch (_) { /* noop */ }
    empty(container);
  };
}

/** Smoke-test helper — returns a detached element with all controls. */
export function renderA11ySection() {
  const wrap = document.createElement('div');
  renderA11yPanel(wrap);
  return wrap;
}

// ------------------------------------------------------------------
// Builders
// ------------------------------------------------------------------

function build(uid) {
  const a = state.getSlice('a11y') || {};

  return h('div', { class: 'a11y-panel', role: 'region', 'aria-labelledby': `${uid}-heading` }, [
    // Header
    h('header', { class: 'a11y-panel-header' }, [
      h('h2', { id: `${uid}-heading`, class: 'a11y-panel-title' }, t('a11y.panel.title')),
      h('p',  { class: 'a11y-panel-subtitle' }, t('a11y.panel.subtitle'))
    ]),

    // 1. Reading comfort
    section(t('a11y.panel.section.reading'), `${uid}-reading`, [
      toggleRow({
        id: `${uid}-dyslexia`,
        label: t('a11y.dyslexia.toggle'),
        describedById: `${uid}-dyslexia-desc`,
        description: t('a11y.dyslexia.description'),
        checked: !!a.dyslexiaMode,
        onChange: (v) => updateA11y('dyslexiaMode', v)
      }),
      segmentedRow({
        label: t('a11y.font.scaleLabel'),
        hint:  t('a11y.font.scaleHint'),
        name: `${uid}-fontScale`,
        value: a.fontScale,
        options: FONT_SCALES.map(s => ({ value: s, label: `${s}×` })),
        onChange: (v) => updateA11y('fontScale', v)
      }),
      segmentedRow({
        label: t('a11y.font.lineHeightLabel'),
        name: `${uid}-lineHeight`,
        value: a.lineHeight,
        options: LINE_HEIGHTS.map(v => ({ value: v, label: String(v) })),
        onChange: (v) => updateA11y('lineHeight', v)
      }),
      segmentedRow({
        label: t('a11y.font.letterSpacingLabel'),
        name: `${uid}-letterSpacing`,
        value: a.letterSpacing,
        options: LETTER_SPACES.map(v => ({ value: v, label: `${v}em` })),
        onChange: (v) => updateA11y('letterSpacing', v)
      })
    ]),

    // 2. Motion and animation
    section(t('a11y.panel.section.motion'), `${uid}-motion`, [
      segmentedRow({
        label: t('a11y.motion.label'),
        name: `${uid}-motion`,
        value: motionKey(a.reduceMotion),
        options: [
          { value: 'os',  label: t('a11y.motion.optionOs')  },
          { value: 'on',  label: t('a11y.motion.optionOn')  },
          { value: 'off', label: t('a11y.motion.optionOff') }
        ],
        onChange: (k) => updateA11y('reduceMotion', motionFromKey(k)),
        describedById: `${uid}-motion-desc`
      }),
      h('p', { id: `${uid}-motion-desc`, class: 'a11y-panel-help' }, t('a11y.motion.description'))
    ]),

    // 3. Vision and color
    section(t('a11y.panel.section.vision'), `${uid}-vision`, [
      toggleRow({
        id: `${uid}-contrast`,
        label: t('a11y.contrast.toggle'),
        describedById: `${uid}-contrast-desc`,
        description: t('a11y.contrast.description'),
        checked: !!a.highContrast,
        onChange: (v) => updateA11y('highContrast', v)
      }),
      segmentedRow({
        label: t('a11y.colorBlind.label'),
        name: `${uid}-colorBlind`,
        value: a.colorBlindMode || 'none',
        options: COLOR_BLIND.map(mode => ({
          value: mode,
          label: t(`a11y.colorBlind.option${cap(mode)}`)
        })),
        onChange: (v) => updateA11y('colorBlindMode', v),
        stacked: true
      })
    ]),

    // 4. Audio and speech
    section(t('a11y.panel.section.audio'), `${uid}-audio`, [
      toggleRow({
        id: `${uid}-transcribe`,
        label: t('a11y.transcribe.toggle'),
        describedById: `${uid}-transcribe-desc`,
        description: t('a11y.transcribe.description'),
        checked: !!a.transcribeVoice,
        onChange: (v) => updateA11y('transcribeVoice', v)
      }),
      h('div', {
        id: `${uid}-transcribe-slowmode`,
        class: 'a11y-panel-banner',
        'data-slot': 'transcribe-slowmode',
        hidden: true,
        role: 'status',
        'aria-live': 'polite'
      }, t('a11y.transcribe.slowMode'))
    ]),

    // 5. Connection
    section(t('a11y.panel.section.bandwidth'), `${uid}-bandwidth`, [
      toggleRow({
        id: `${uid}-lowbw`,
        label: t('a11y.lowBw.toggle'),
        describedById: `${uid}-lowbw-desc`,
        description: t('a11y.lowBw.description'),
        checked: !!a.lowBandwidth,
        onChange: (v) => updateA11y('lowBandwidth', v)
      })
    ]),

    // 6. Mobility — v1.5 wheelchair layer state binding
    section(t('a11y.panel.section.mobility'), `${uid}-mobility`, [
      toggleRow({
        id: `${uid}-wheelchair`,
        label: t('a11y.wheelchair.toggle'),
        describedById: `${uid}-wheelchair-desc`,
        description: t('a11y.wheelchair.description'),
        checked: !!a.wheelchairLayer,
        onChange: (v) => updateA11y('wheelchairLayer', v)
      })
    ]),

    // Footer
    h('footer', { class: 'a11y-panel-footer' }, [
      h('a', {
        class: 'a11y-panel-demo-link',
        href: 'pages/accessibility-demo.html',
        target: '_blank',
        rel: 'noopener'
      }, [
        h('span', null, t('a11y.demo.link')),
        h('span', { class: 'a11y-panel-external', 'aria-hidden': 'true' }, ' ↗')
      ]),
      h('p', { class: 'a11y-panel-save-hint' }, t('a11y.panel.saveHint'))
    ])
  ]);
}

// ------------------------------------------------------------------
// Sub-builders
// ------------------------------------------------------------------

function section(title, headingId, children) {
  return h('section', { class: 'a11y-panel-section', 'aria-labelledby': headingId }, [
    h('h3', { id: headingId, class: 'a11y-panel-section-title' }, title),
    ...children
  ]);
}

/**
 * Toggle row — renders a `role="switch"` button with Space/Enter support.
 * Using a real <button> + role="switch" gives us full keyboard handling for
 * free (Space activates any button) and correct SR semantics.
 */
function toggleRow({ id, label, description, describedById, checked, onChange }) {
  const labelId = `${id}-label`;
  return h('div', { class: 'a11y-panel-row a11y-panel-row-toggle' }, [
    h('div', { class: 'a11y-panel-row-text' }, [
      h('span', { id: labelId, class: 'a11y-panel-row-label' }, label),
      description
        ? h('p', { id: describedById, class: 'a11y-panel-row-desc' }, description)
        : null
    ]),
    h('button', {
      id,
      type: 'button',
      class: 'a11y-switch',
      role: 'switch',
      'aria-checked': checked ? 'true' : 'false',
      'aria-labelledby': labelId,
      'aria-describedby': describedById || null,
      onclick: () => onChange(!checked)
    }, [
      h('span', { class: 'a11y-switch-track', 'aria-hidden': 'true' }, [
        h('span', { class: 'a11y-switch-thumb' })
      ])
    ])
  ]);
}

/**
 * Segmented radio group. Uses native `<input type="radio" name="...">` so the
 * browser gives us arrow-key navigation and roving focus for free.
 */
function segmentedRow({ label, hint, name, value, options, onChange, describedById, stacked }) {
  const groupId = `${name}-group`;
  const hintId  = hint ? `${name}-hint` : null;
  const describedBy = [describedById, hintId].filter(Boolean).join(' ') || null;

  return h('div', { class: 'a11y-panel-row a11y-panel-row-segmented' }, [
    h('div', { class: 'a11y-panel-row-text' }, [
      h('span', { id: groupId, class: 'a11y-panel-row-label' }, label),
      hint ? h('p', { id: hintId, class: 'a11y-panel-row-desc' }, hint) : null
    ]),
    h('div', {
      class: `a11y-segmented${stacked ? ' a11y-segmented-stacked' : ''}`,
      role: 'radiogroup',
      'aria-labelledby': groupId,
      'aria-describedby': describedBy
    }, options.map((opt, idx) => {
      const inputId = `${name}-${idx}`;
      const checked = String(opt.value) === String(value);
      return h('label', {
        class: 'a11y-segmented-option',
        for: inputId,
        'data-checked': checked ? 'true' : 'false'
      }, [
        h('input', {
          id: inputId,
          type: 'radio',
          name,
          class: 'a11y-segmented-input',
          value: String(opt.value),
          checked: checked,
          onchange: (ev) => { if (ev.target.checked) onChange(opt.value); }
        }),
        h('span', { class: 'a11y-segmented-label' }, opt.label)
      ]);
    }))
  ]);
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function updateA11y(key, value) {
  state.update('a11y', a => ({ ...(a || {}), [key]: value }));
}

function motionKey(v) {
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'os';
}

function motionFromKey(k) {
  if (k === 'on') return true;
  if (k === 'off') return false;
  return null;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
