// js/features/seat-credits.js
// DiscoverEU gives travelers 4 free international train reservations
// ("seat credits") — but the list of which legs burn a credit and the
// logic of "who's paid, who's free" is confusing. This module does the
// counting so the UI can show a live 2 / 4 indicator. Competitive
// differentiator #2.

import { getRouteReservations } from './reservations.js';
import { state } from '../state.js';

/**
 * Return a snapshot of seat-credit usage for the current (or provided)
 * route. Consumers use this to render a progress indicator and to
 * decide whether to show the "credits exhausted" warning.
 *
 *   const { used, limit, remaining, exceeded } = computeSeatCredits(route);
 */
export function computeSeatCredits(route = state.getSlice('route')) {
  const limit = route?.seatCreditsLimit ?? 4;
  const reservations = getRouteReservations(route);

  // Only international, cross-border reservations count against the
  // DiscoverEU free-credit quota. Domestic high-speed reservations
  // (e.g. Frecciarossa Rome→Milan) still have to be paid but don't
  // burn a free credit — they're extra. We surface both counts.
  let used = 0;
  let domesticPaid = 0;
  for (const r of reservations) {
    if (!r.mandatory) continue;
    if (r.legFrom === r.legTo) domesticPaid += 1;
    else used += 1;
  }

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exceeded: used > limit,
    domesticPaid,
    totalReservations: reservations.length
  };
}
