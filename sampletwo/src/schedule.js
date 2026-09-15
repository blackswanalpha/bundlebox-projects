// schedule.js — who is on call at an instant.
//
// A rotation is a start instant, a shift length and an ordered list of members.
// Who is on call at T is arithmetic on those three, which is why this file has
// no timezone data and no stored assignments: a stored assignment drifts from
// the rule that produced it the first time anybody edits the list, and then the
// board and the page disagree about who was responsible.
//
// Shifts before the start instant are answered rather than refused. A rotation
// created on Wednesday still has to say who held the pager on Monday, because
// that is the question an incident review asks.
import { read } from "./store.js";

export const HOUR = 3_600_000;

export const byId = (db, id) => db.rotations.find((r) => r.id === id) || null;

/** Whole shifts elapsed since the rotation started, negative before it. */
function shiftIndex(rotation, atMs) {
  const span = Math.max(1, Number(rotation.shift_hours) * HOUR);
  return Math.floor((atMs - rotation.starts_ms) / span);
}

export function onCallAt(db, rotationId, atMs) {
  const rot = byId(db, rotationId);
  if (!rot || !rot.members.length) return null;
  const n = rot.members.length;
  // Modulo that stays positive for shifts before the start instant; the % of a
  // negative numerator is negative in JS and would index off the front.
  const i = ((shiftIndex(rot, atMs) % n) + n) % n;
  return rot.members[i];
}

/** The member after the one on call — the second name an escalation reaches. */
export function nextUpAt(db, rotationId, atMs) {
  const rot = byId(db, rotationId);
  if (!rot || rot.members.length < 2) return null;
  const n = rot.members.length;
  const i = ((shiftIndex(rot, atMs) % n) + n) % n;
  return rot.members[(i + 1) % n];
}

/** When the pager changes hands next. The console shows it because "you are on
 *  call" means something different with four minutes left than with six hours. */
function handoffAfter(db, rotationId, atMs) {
  const rot = byId(db, rotationId);
  if (!rot) return null;
  const span = Math.max(1, Number(rot.shift_hours) * HOUR);
  return rot.starts_ms + (shiftIndex(rot, atMs) + 1) * span;
}

/** Who is on call for a service, resolved through the service's rotation. */
export function onCallForService(db, serviceId, atMs) {
  const svc = db.services.find((s) => s.id === serviceId);
  return svc ? onCallAt(db, svc.rotation_id, atMs) : null;
}

export function board(atMs = null) {
  const db = read();
  const at = atMs ?? db.clock_ms;
  return db.rotations.map((r) => ({
    rotation_id: r.id,
    name: r.name,
    shift_hours: r.shift_hours,
    on_call: onCallAt(db, r.id, at),
    next_up: nextUpAt(db, r.id, at),
    handoff_ms: handoffAfter(db, r.id, at),
    services: db.services.flatMap((s) => (s.rotation_id === r.id ? [s.key] : [])),
  }));
}
