// clock.js — the instant every other file is a function of.
//
// Escalation is elapsed time. A service whose only clock is `Date.now()` can be
// tested one way: by waiting. Five minutes of waiting per assertion is a corpus
// nobody runs twice, so the clock is a value in the store and `POST /admin/clock`
// moves it. That is the single decision this service is built around — every
// deadline below is an instant in milliseconds, never a timer.
//
// A deployment that wants the wall clock sets SAMPLETWO_CLOCK=wall and gets it;
// the advance endpoint then refuses rather than pretending to have moved time.
import { read, update } from "./store.js";

export const VIRTUAL = (process.env.SAMPLETWO_CLOCK || "virtual") !== "wall";

export const now = () => (VIRTUAL ? read().clock_ms : Date.now());

/** Move the clock forward by whole milliseconds. Forward only: an escalation
 *  that already fired cannot be un-fired by rewinding, so a store that allowed
 *  it would hold a timeline that contradicts its own notifications. */
export function advance(ms) {
  const step = Math.trunc(Number(ms));
  if (!Number.isFinite(step) || step < 0) return null;
  return update((db) => (db.clock_ms += step));
}

export const iso = (ms) => new Date(ms).toISOString();
