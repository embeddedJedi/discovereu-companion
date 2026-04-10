// js/features/reservations.js
// Mandatory reservation lookup for a route.
//
// For every adjacent stop pair we check data/reservations.json for a
// matching entry. A match means pass holders need to buy a paid seat
// reservation before boarding. The first competitive differentiator.

import { state } from '../state.js';

/**
 * Walk adjacent stop pairs of a route and return the list of mandatory
 * reservations the traveler will hit. Each result is annotated with the
 * leg (legFrom / legTo) and a human-readable index so the UI can render
 * them next to the correct stop.
 *
 * Also handles the "domestic" case: an entry with `bidirectional: false`
 * and `from === to` applies whenever two consecutive stops are both in
 * that country (e.g. Rome → Milan inside Italy).
 */
export function getRouteReservations(route) {
  const stops = route?.stops || [];
  if (stops.length < 2) return [];

  const all = state.getSlice('reservations') || [];
  const hits = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const fromId = stops[i].countryId;
    const toId   = stops[i + 1].countryId;
    const match  = findMatch(all, fromId, toId);
    if (match) {
      hits.push({
        ...match,
        legIndex: i,
        legFrom:  fromId,
        legTo:    toId
      });
    }
  }

  return hits;
}

function findMatch(list, fromId, toId) {
  for (const r of list) {
    // Explicit directional pair
    if (r.from === fromId && r.to === toId) return r;
    // Bidirectional cross-border pair
    if (r.bidirectional && r.from === toId && r.to === fromId) return r;
    // Domestic rule: from === to and both stops are in the same country.
    // Only applies when two consecutive stops share a country (e.g. the
    // user has chained two cities in Italy).
    if (!r.bidirectional && r.from === r.to && fromId === toId && r.from === fromId) return r;
  }
  return null;
}

/** Handy check used by the seat-credits tracker. */
export function hasMandatoryReservation(fromId, toId) {
  const all = state.getSlice('reservations') || [];
  const match = findMatch(all, fromId, toId);
  return !!(match && match.mandatory);
}
