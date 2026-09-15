// notify.js — the outbox.
//
// Nothing here sends anything. A page is a row with an instant, a reason and a
// responder, and that row is the assertion the corpus makes: "the second
// escalation reached Chi" is checkable, where "an SMS was dispatched" is not.
//
// The outbox is also the deduplication record. Suppressing a repeat page is a
// behaviour worth testing, and it can only be tested against a list of what was
// actually sent.
import { nextId } from "./store.js";

const REASONS = new Set(["page", "escalation", "raise", "snooze-expired", "assignment", "resolve"]);

export function send(db, { incident, responderId, reason, atMs, note = "" }) {
  if (!responderId) return null;
  const row = {
    id: `N${nextId(db, "note")}`,
    incident_id: incident.id,
    incident_key: incident.key,
    responder_id: responderId,
    reason: REASONS.has(reason) ? reason : "page",
    severity: incident.severity,
    at_ms: atMs,
    note,
  };
  db.notifications.push(row);
  return row;
}

export const forIncident = (db, incidentId) => db.notifications.filter((n) => n.incident_id === incidentId);
