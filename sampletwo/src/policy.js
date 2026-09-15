// policy.js — how long a page goes unanswered before it reaches somebody else.
//
// A policy is a list of steps, each an offset in minutes from the moment the
// incident opened and a target to reach at that offset. Offsets are from the
// OPEN instant rather than from the previous step, so a policy reads the way an
// on-call agreement is actually written — "five minutes, then fifteen" — and a
// step that is edited does not silently move every step after it.
//
// Targets are roles in the rotation, never people. A policy that names a person
// is a policy that pages somebody on holiday.
import { nextUpAt, onCallAt } from "./schedule.js";

export const byId = (db, id) => db.policies.find((p) => p.id === id) || null;

/** The step an incident is at after `n` escalations, or null past the end. */
export const stepAt = (policy, n) => (policy && n >= 0 && n < policy.steps.length ? policy.steps[n] : null);

/** The instant step `n` is due, measured from when the incident opened. */
export function dueAt(policy, n, openedMs) {
  const step = stepAt(policy, n);
  return step ? openedMs + Math.round(Number(step.after_minutes) * 60_000) : null;
}

/** Who a step reaches, resolved at the instant it fires rather than at the
 *  instant the incident opened. An escalation that crosses a handoff must reach
 *  whoever holds the pager now; reaching the previous shift is how a page lands
 *  on a phone that is face-down on a bedside table. */
export function targetOf(db, step, rotationId, atMs) {
  if (!step) return null;
  if (step.target === "oncall") return onCallAt(db, rotationId, atMs);
  if (step.target === "next") return nextUpAt(db, rotationId, atMs) ?? onCallAt(db, rotationId, atMs);
  if (step.target === "commander") return db.responders.find((r) => r.role === "commander")?.id ?? null;
  return null;
}

export function describe(db, policyId) {
  const p = byId(db, policyId);
  if (!p) return null;
  return { id: p.id, name: p.name, steps: p.steps.map((s, i) => ({ step: i, after_minutes: s.after_minutes, target: s.target })) };
}
