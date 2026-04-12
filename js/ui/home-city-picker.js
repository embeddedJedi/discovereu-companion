// js/ui/home-city-picker.js
// Shared country+city picker. Used by welcome-wizard and route-builder.
import { h } from '../utils/dom.js';
import { state } from '../state.js';
import { t } from '../i18n/i18n.js';

/**
 * Render a country + city select pair into `container`.
 * Calls onChange({ countryId, cityId }) whenever either changes.
 */
export function renderHomeCityPicker(container, { countryId, cityId, onChange }) {
  const countries = state.getSlice('countries') || [];
  let current = { countryId: countryId || 'TR', cityId };

  const citySelect = h('select', { 'aria-label': t('route.home.city') });
  const countrySelect = h('select', { 'aria-label': t('route.home.country') },
    countries.map(c => h('option', { value: c.id, selected: c.id === current.countryId }, c.name || c.id))
  );

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderCities() {
    const country = countries.find(c => c.id === current.countryId);
    const cities = country?.cities || [];
    clearNode(citySelect);
    cities.forEach(city => {
      const opt = h('option', { value: city.id, selected: city.id === current.cityId }, city.name);
      citySelect.appendChild(opt);
    });
    if (!cities.find(c => c.id === current.cityId)) {
      current.cityId = cities[0]?.id;
    }
  }

  countrySelect.addEventListener('change', () => {
    current.countryId = countrySelect.value;
    renderCities();
    onChange({ ...current });
  });
  citySelect.addEventListener('change', () => {
    current.cityId = citySelect.value;
    onChange({ ...current });
  });

  renderCities();
  clearNode(container);
  container.append(
    h('label', {}, t('route.home.country')), countrySelect,
    h('label', {}, t('route.home.city')), citySelect
  );
  return () => ({ ...current });
}

/**
 * Resolve { lat, lng, name, countryId, cityId } for the user's home city.
 * Falls back to the first city in homeCountry if the stored homeCity is missing.
 */
export function resolveHomeCoords() {
  const { homeCountry, homeCity } = state.getSlice('user');
  const countries = state.getSlice('countries') || [];
  const country = countries.find(c => c.id === homeCountry);
  if (!country) return null;
  const city = (country.cities || []).find(c => c.id === homeCity) || country.cities?.[0];
  if (!city) return null;
  return { lat: city.lat, lng: city.lng, name: city.name, countryId: country.id, cityId: city.id };
}
