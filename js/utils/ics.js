// js/utils/ics.js
// Minimal RFC 5545 builder for single-event calendar files.
// Used by FutureMe (time capsule reveal alarm) and the Turkish consulate
// reminder card. No external dependency — pure string templating.
//
// Shared contract: every VEVENT carries a stable UID so re-exporting the
// same appointment overwrites the calendar entry instead of duplicating.
// Alarms are emitted as VALARM blocks with TRIGGER:-PT<N>M offsets.

const PROD_ID = '-//DiscoverEU Companion//EN';

function pad(n) { return String(n).padStart(2, '0'); }

/** Format a Date as UTC in the RFC 5545 DATE-TIME form (YYYYMMDDTHHMMSSZ). */
function toICalUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

/** RFC 5545 line folding + escape for text values. */
function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push(i === 0 ? chunk : ' ' + chunk);
    i += i === 0 ? 75 : 74;
  }
  return out.join('\r\n');
}

function line(key, value) {
  return foldLine(`${key}:${escapeText(value)}`);
}

/**
 * Build an iCalendar string for a single VEVENT with optional VALARMs.
 *
 * opts:
 *   uid         — required, stable identifier
 *   summary     — required, event title
 *   description — optional, long text
 *   location    — optional
 *   startDate   — required, Date or ISO string; event duration is 60 minutes
 *   alarms      — optional array of { minutesBefore, description }
 */
export function buildICS({ uid, summary, description, location, startDate, alarms = [] }) {
  if (!uid || !summary || !startDate) {
    throw new Error('[ics] uid, summary, startDate are required');
  }
  const start = toICalUTC(startDate);
  const endDate = new Date(new Date(startDate).getTime() + 60 * 60 * 1000);
  const end = toICalUTC(endDate);
  const stamp = toICalUTC(new Date());

  const valarms = (alarms || []).map(a => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    line('DESCRIPTION', a.description || summary),
    `TRIGGER:-PT${Math.max(0, a.minutesBefore | 0)}M`,
    'END:VALARM'
  ].join('\r\n'));

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    line('UID', uid),
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    line('SUMMARY', summary),
    description ? line('DESCRIPTION', description) : null,
    location    ? line('LOCATION', location)      : null,
    ...valarms,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].filter(Boolean);

  return body.join('\r\n');
}

/** Trigger a download of the given ICS text. */
export function downloadICS(filename, icsText) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
