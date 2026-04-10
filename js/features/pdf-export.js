// js/features/pdf-export.js
// Print-ready itinerary export via jsPDF. Not a pixel snapshot — we lay
// out the document with vector text so it stays crisp, selectable, and
// translates cleanly even on a cheap hostel printer.
//
// The jsPDF CDN ships a UMD bundle that attaches to `window.jspdf`.

/* global jspdf */

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { computeBudget } from '../ui/budget.js';
import { computeCO2 } from './co2.js';
import { computeSeatCredits } from './seat-credits.js';
import { getRouteReservations } from './reservations.js';
import { showToast } from '../ui/toast.js';

// A4 portrait, millimetres
const PAGE_W = 210;
const MARGIN_X = 18;
const LINE_H = 6;

const BLUE = [42, 71, 194];
const GOLD = [244, 180, 0];
const GRAY = [110, 118, 140];

export function exportItineraryPDF() {
  if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
    showToast(t('wrapped.libMissing'), 'danger');
    return;
  }

  const route = state.getSlice('route');
  if (!route?.stops?.length) {
    showToast(t('wrapped.empty'), 'warning');
    return;
  }

  const { jsPDF } = jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const user = state.getSlice('user');

  let cursor = drawHeader(doc, route);
  cursor = drawStops(doc, route, cursor + 4);
  cursor = drawReservations(doc, route, cursor + 6);
  cursor = drawCO2Summary(doc, route, cursor + 6);
  cursor = drawBudget(doc, route, user, cursor + 6);
  drawFooter(doc);

  const filename = (route.name || 'discovereu-itinerary')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    || 'discovereu-itinerary';
  doc.save(`${filename}.pdf`);
  showToast(t('pdf.saved'), 'success');
}

// ─── Sections ────────────────────────────────────────────────────────────

function drawHeader(doc, route) {
  // Blue brand strip
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DiscoverEU Companion', MARGIN_X, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Engage · Connect · Empower', MARGIN_X, 18);

  // Gold star accent
  doc.setFillColor(...GOLD);
  doc.circle(PAGE_W - MARGIN_X, 11, 5, 'F');
  doc.setTextColor(13, 26, 84);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('★', PAGE_W - MARGIN_X - 2.2, 13);

  // Title
  doc.setTextColor(...BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(route.name || t('wrapped.defaultName'), MARGIN_X, 34);

  // Meta line
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const today = new Date().toISOString().slice(0, 10);
  doc.text(t('pdf.generated', { date: today }), MARGIN_X, 40);

  return 46;
}

function drawStops(doc, route, startY) {
  let y = section(doc, t('pdf.section.stops'), startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 34, 45);

  route.stops.forEach((stop, i) => {
    const country = countryById(stop.countryId);
    const name = country?.name || stop.countryId;
    const nights = Number(stop.nights) || 0;

    // Numbered bullet
    doc.setFillColor(...BLUE);
    doc.circle(MARGIN_X + 3, y - 1.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(i + 1), MARGIN_X + 3, y - 0.3, { align: 'center' });

    // Country + nights
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 34, 45);
    doc.text(name, MARGIN_X + 10, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(t('route.stopNights', { n: nights }), PAGE_W - MARGIN_X, y, { align: 'right' });

    y += LINE_H;
  });

  return y;
}

function drawReservations(doc, route, startY) {
  const reservations = getRouteReservations(route);
  if (reservations.length === 0) return startY;

  let y = section(doc, t('pdf.section.reservations'), startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  reservations.forEach(r => {
    const label = r.legFrom === r.legTo
      ? `${r.legFrom} domestic`
      : `${r.legFrom} → ${r.legTo}`;

    doc.setTextColor(30, 34, 45);
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN_X, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(r.operator || '', MARGIN_X + 40, y);

    if (r.costEUR) {
      doc.text(`~€${r.costEUR}`, PAGE_W - MARGIN_X, y, { align: 'right' });
    }
    y += 5;

    if (r.sampleRoute) {
      doc.setFontSize(8);
      doc.text(r.sampleRoute, MARGIN_X + 2, y);
      doc.setFontSize(9);
      y += 4;
    }
    y += 1;
  });

  return y;
}

function drawCO2Summary(doc, route, startY) {
  const co2 = computeCO2(route);
  if (co2.totalKm === 0) return startY;
  const credits = computeSeatCredits(route);

  let y = section(doc, t('pdf.section.impact'), startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 34, 45);

  const lines = [
    `${t('co2.distance')}: ${co2.totalKm} km`,
    `${t('co2.byRail')}: ${co2.railKg} kg CO₂`,
    `${t('co2.ifFlew')}: ${co2.flightKg} kg CO₂`,
    `${t('pdf.co2Saved')}: ${co2.savedKg} kg (${co2.savedPct}%)`,
    `${t('pdf.seatCredits')}: ${credits.used} / ${credits.limit}`
  ];

  lines.forEach(line => {
    doc.text(line, MARGIN_X, y);
    y += 5;
  });

  return y;
}

function drawBudget(doc, route, user, startY) {
  const budget = computeBudget(route, user);
  if (budget.empty) return startY;

  let y = section(doc, t('pdf.section.budget'), startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const rows = [
    [t('budget.totals.accommodation'), `€${budget.accommodation}`],
    [t('budget.totals.food'),          `€${budget.food}`],
    [t('budget.totals.activities'),    `€${budget.activities}`],
    [t('budget.totals.transport'),     `€${budget.transport}`]
  ];

  doc.setTextColor(30, 34, 45);
  rows.forEach(([label, value]) => {
    doc.text(label, MARGIN_X, y);
    doc.text(value, PAGE_W - MARGIN_X, y, { align: 'right' });
    y += 5;
  });

  // Bold totals
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(t('budget.totals.perPerson'), MARGIN_X, y);
  doc.text(`€${budget.perPerson}`, PAGE_W - MARGIN_X, y, { align: 'right' });
  y += 5;
  doc.text(t('budget.totals.group', { n: budget.groupSize }), MARGIN_X, y);
  doc.text(`€${budget.groupTotal}`, PAGE_W - MARGIN_X, y, { align: 'right' });

  return y + 4;
}

function drawFooter(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, pageH - 14, PAGE_W - MARGIN_X, pageH - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('DiscoverEU Companion — open source · MIT', MARGIN_X, pageH - 8);
  doc.text('discovereu-companion', PAGE_W - MARGIN_X, pageH - 8, { align: 'right' });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function section(doc, title, startY) {
  // Section header
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN_X, startY - 4, 3, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text(title, MARGIN_X + 5, startY);

  return startY + 8;
}
