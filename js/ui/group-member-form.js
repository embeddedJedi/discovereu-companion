// js/ui/group-member-form.js
// Reusable add/edit form for a single group member.
// Shipped in v1.7 Multi-origin Group Planner (sub-project, Task 5).
//
// Exports:
//   renderMemberForm(container, { member, onSubmit, onCancel }) -> cleanup fn
//
// Member shape matches state.group members:
//   { id, displayName, homeCountry, homeCity, preferences: { kindLikes, avoidCategories } }

import { h, empty } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { renderHomeCityPicker } from './home-city-picker.js';

const KIND_LIKE_KEYS = ['nature', 'culture', 'nightlife', 'food', 'beach', 'history'];
const AVOID_KEYS = ['nightlife', 'crowds', 'hiking'];

const MIN_NAME_CHARS = 2;
const MAX_NAME_CHARS = 40;

/**
 * Render the member form into `container`.
 * Returns a cleanup function that removes listeners and empties the container.
 */
export function renderMemberForm(container, { member = null, onSubmit, onCancel } = {}) {
  const isEdit = !!member;
  const initial = {
    id: member?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mbr_${Date.now().toString(36)}`),
    displayName: member?.displayName ?? '',
    homeCountry: member?.homeCountry ?? 'TR',
    homeCity: member?.homeCity ?? null,
    kindLikes: new Set(member?.preferences?.kindLikes ?? []),
    avoidCategories: new Set(member?.preferences?.avoidCategories ?? [])
  };

  // --- Header ---
  const titleId = `group-member-form-title-${initial.id}`;
  const title = h('h3',
    { id: titleId, class: 'group-member-form__title' },
    isEdit ? t('group.member.edit') || 'Edit member' : t('group.member.add')
  );

  // --- Error live region ---
  const errorRegion = h('p', {
    class: 'group-member-form__error',
    role: 'status',
    'aria-live': 'polite'
  });

  // --- Display name ---
  const nameId = `group-member-name-${initial.id}`;
  const nameInput = h('input', {
    id: nameId,
    name: 'displayName',
    type: 'text',
    maxlength: MAX_NAME_CHARS,
    required: true,
    'aria-required': 'true',
    autocomplete: 'off',
    placeholder: t('group.member.namePlaceholder'),
    value: initial.displayName,
    class: 'group-member-form__input'
  });
  const nameLabel = h('label', { for: nameId, class: 'group-member-form__label' }, t('group.member.namePlaceholder'));
  const nameField = h('div', { class: 'group-member-form__field' }, [nameLabel, nameInput]);

  // --- Home city picker ---
  const pickerHost = h('div', { class: 'group-member-form__picker' });
  const homeCityState = { countryId: initial.homeCountry, cityId: initial.homeCity?.cityId || initial.homeCity || null };
  renderHomeCityPicker(pickerHost, {
    countryId: homeCityState.countryId,
    cityId: homeCityState.cityId,
    onChange: ({ countryId, cityId }) => {
      homeCityState.countryId = countryId;
      homeCityState.cityId = cityId;
      updateValidity();
    }
  });

  const homeGroup = h('div', { class: 'group-member-form__field group-member-form__field--picker' }, [
    h('span', { class: 'group-member-form__label' }, t('route.home.country')),
    pickerHost
  ]);

  // --- Preferences (collapsed by default) ---
  function checkboxGroup(kind, keys, selectedSet, legendText) {
    const legend = h('legend', { class: 'group-member-form__legend' }, legendText);
    const boxes = keys.map((key, i) => {
      const id = `group-member-${kind}-${initial.id}-${i}`;
      const input = h('input', {
        id,
        type: 'checkbox',
        name: kind,
        value: key,
        checked: selectedSet.has(key),
        class: 'group-member-form__checkbox'
      });
      input.addEventListener('change', () => {
        if (input.checked) selectedSet.add(key); else selectedSet.delete(key);
      });
      const label = h('label', { for: id, class: 'group-member-form__checkbox-label' }, [
        input,
        h('span', {}, t(`filters.categories.${key}`) || key)
      ]);
      return label;
    });
    return h('fieldset', { class: 'group-member-form__fieldset' }, [
      legend,
      h('div', { class: 'group-member-form__checkbox-grid' }, boxes)
    ]);
  }

  const prefsContent = h('div', { class: 'group-member-form__prefs-content' }, [
    checkboxGroup('kindLikes', KIND_LIKE_KEYS, initial.kindLikes, t('group.member.kindLikes') || 'Likes'),
    checkboxGroup('avoidCategories', AVOID_KEYS, initial.avoidCategories, t('group.member.avoid') || 'Avoid')
  ]);
  const prefsDetails = h('details', { class: 'group-member-form__prefs' }, [
    h('summary', { class: 'group-member-form__prefs-summary' }, t('group.member.preferences') || 'Preferences'),
    prefsContent
  ]);

  // --- Buttons ---
  const submitBtn = h('button', {
    type: 'submit',
    class: 'btn btn-primary group-member-form__submit'
  }, isEdit ? (t('group.member.save') || 'Save changes') : t('group.member.add'));

  const cancelBtn = h('button', {
    type: 'button',
    class: 'btn btn-ghost group-member-form__cancel'
  }, t('common.cancel') || 'Cancel');

  const actions = h('div', { class: 'group-member-form__actions' }, [cancelBtn, submitBtn]);

  // --- Form root ---
  const form = h('form', {
    class: 'group-member-form',
    'aria-labelledby': titleId,
    novalidate: true
  }, [
    title,
    errorRegion,
    nameField,
    homeGroup,
    prefsDetails,
    actions
  ]);

  // --- Validation ---
  function isValid() {
    const nameOk = nameInput.value.trim().length >= MIN_NAME_CHARS;
    const cityOk = !!homeCityState.cityId;
    return nameOk && cityOk;
  }

  function updateValidity() {
    submitBtn.disabled = !isValid();
  }

  function buildMemberData() {
    return {
      id: initial.id,
      displayName: nameInput.value.trim(),
      homeCountry: homeCityState.countryId,
      homeCity: homeCityState.cityId,
      preferences: {
        kindLikes: KIND_LIKE_KEYS.filter(k => initial.kindLikes.has(k)),
        avoidCategories: AVOID_KEYS.filter(k => initial.avoidCategories.has(k))
      }
    };
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (!isValid()) {
      const msgs = [];
      if (nameInput.value.trim().length < MIN_NAME_CHARS) {
        nameInput.setAttribute('aria-invalid', 'true');
        msgs.push(t('group.member.errors.name') || 'Display name is required.');
      } else {
        nameInput.removeAttribute('aria-invalid');
      }
      if (!homeCityState.cityId) {
        msgs.push(t('group.member.errors.city') || 'Please pick a home city.');
      }
      errorRegion.textContent = msgs.join(' ');
      return;
    }
    errorRegion.textContent = '';
    try {
      onSubmit?.(buildMemberData());
    } catch (err) {
      console.error('[group-member-form] onSubmit threw', err);
    }
  }

  function handleKeydown(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      onCancel?.();
    }
  }

  function handleCancelClick() {
    onCancel?.();
  }

  function handleNameInput() {
    if (nameInput.value.trim().length >= MIN_NAME_CHARS) {
      nameInput.removeAttribute('aria-invalid');
    }
    updateValidity();
  }

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('keydown', handleKeydown);
  nameInput.addEventListener('input', handleNameInput);
  cancelBtn.addEventListener('click', handleCancelClick);

  empty(container);
  container.appendChild(form);
  updateValidity();

  // Focus the display name for add mode; keep existing focus for edit.
  if (!isEdit) {
    requestAnimationFrame(() => nameInput.focus());
  }

  // Cleanup
  return function cleanup() {
    form.removeEventListener('submit', handleSubmit);
    form.removeEventListener('keydown', handleKeydown);
    nameInput.removeEventListener('input', handleNameInput);
    cancelBtn.removeEventListener('click', handleCancelClick);
    empty(container);
  };
}
