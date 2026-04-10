// js/utils/format.js
// Locale-aware formatters for currency, numbers, dates, durations.

const LOCALE_MAP = { en: 'en-GB', tr: 'tr-TR', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };

function localeFor(lang) { return LOCALE_MAP[lang] || 'en-GB'; }

/** Format a number with thousands separators. */
export function formatNumber(value, lang = 'en') {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(localeFor(lang)).format(value);
}

/** Format a currency value. */
export function formatCurrency(value, currency = 'EUR', lang = 'en') {
  if (value == null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency,
      maximumFractionDigits: value >= 100 ? 0 : 2
    }).format(value);
  } catch (e) {
    return `${Math.round(value)} ${currency}`;
  }
}

/** Format a relative date (e.g. "in 12 days"). */
export function formatRelativeDays(targetDate, lang = 'en') {
  if (!(targetDate instanceof Date)) targetDate = new Date(targetDate);
  const diffMs = targetDate - new Date();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  try {
    const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
    return rtf.format(days, 'day');
  } catch (e) {
    return `${days >= 0 ? 'in' : ''} ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}${days < 0 ? ' ago' : ''}`;
  }
}

/** Format a duration in minutes as "4h 15m". */
export function formatDuration(minutes, lang = 'en') {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a date as "12 Jul 2026". */
export function formatDate(date, lang = 'en') {
  if (!(date instanceof Date)) date = new Date(date);
  try {
    return new Intl.DateTimeFormat(localeFor(lang), {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(date);
  } catch (e) {
    return date.toDateString();
  }
}

/** Format a weight in kg ("8.2 kg"). */
export function formatKg(value, lang = 'en') {
  if (value == null) return '—';
  return `${formatNumber(value.toFixed(1), lang)} kg`;
}

/** Format distance in km ("1,240 km"). */
export function formatKm(value, lang = 'en') {
  if (value == null) return '—';
  return `${formatNumber(Math.round(value), lang)} km`;
}

/** Format a percentage. */
export function formatPercent(value, lang = 'en') {
  if (value == null) return '—';
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(value);
}
