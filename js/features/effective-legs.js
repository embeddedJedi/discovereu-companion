// js/features/effective-legs.js
// Combines outbound stops + optional return stops + home terminus into
// a single array of stops used for budget, CO2, and seat-credit math.
import { state } from '../state.js';
import { resolveHomeCoords } from '../ui/home-city-picker.js';

/**
 * Return an array of stops that reflects the traveler's full journey
 * when `includeReturnInBudget` is true, otherwise just the outbound stops.
 *
 * The terminal home "stop" is modeled as a zero-night stop so reservation
 * lookups can check the final leg (last real stop → home country).
 */
export function getEffectiveLegs(route = state.getSlice('route')) {
  const outbound = route?.stops || [];
  if (!route?.includeReturnInBudget) return outbound;

  const home = resolveHomeCoords();
  if (!home) return outbound;

  const homeStop = {
    countryId: home.countryId,
    cityId: home.cityId,
    nights: 0,
    transport: route.returnTransport || 'train',
    isHome: true
  };
  return [...outbound, ...(route.returnStops || []), homeStop];
}
