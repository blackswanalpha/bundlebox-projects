// incidents.js — intake, the state machine, and the timeline.
//
// Two rules live here and nowhere else.
//
// **Deduplication.** A monitor that fires every thirty seconds must produce one
// incident, not one hundred and twenty. An alert joins the open incident with
// the same key on the same service; a RESOLVED incident never absorbs, because
// the same symptom returning after a fix is new information and paging nobody
// about it is the failure this whole service exists to prevent.
//
// **The timeline is append-only.** Every transition writes one entry and
// nothing ever edits one. An incident review that cannot trust the order of
// events is a meeting about what people remember.
import { nextId } from "./store.js";
import { dueAt, byId as policyById, stepAt, targetOf } from "./policy.js";
import { onCallForService } from "./schedule.js";
import * as notify from "./notify.js";

// Low to high. Comparison is by index, never by string, because "sev1" sorts
// above "sev2" alphabetically and that is the opposite of what it means.
export const SEVERITIES = ["sev3", "sev2", "sev1"];
const rank = (s) => SEVERITIES.indexOf(String(s));

/** The instant step `n` is due for THIS incident: the policy's offset from the
 *  open instant, plus whatever the incident has been snoozed for. Every caller
 *  goes through here, because a step computed from the raw policy would snap
 *  back to the original schedule the moment an incident is snoozed — and fire
 *  out of order behind the one that was delayed. */
export function dueFor(db, inc, n) {
  const svc = db.services.find((s) => s.id === inc.service_id);
  const at = dueAt(policyById(db, svc?.policy_id), n, inc.opened_ms);
  return at === null ? null : at + (inc.escalation_shift_ms || 0);
}

export const byId = (db, id) => db.incidents.find((i) => i.id === id || i.key === id) || null;
const isOpen = (i) => i.state !== "resolved";

export function log(incident, atMs, kind, by, note = "") {
  incident.timeline.push({ at_ms: atMs, kind, by: by || null, note });
  return incident;
}

const serviceOf = (db, keyOrId) =>
  db.services.find((s) => s.key === keyOrId || s.id === keyOrId) || null;

/** Everything an alert must carry before it can page anybody. Separate from
 *  the intake itself so the refusals read as one list rather than as five
 *  early returns wrapped around the part that does the work. */
function validated(db, body) {
  const svc = serviceOf(db, String(body?.service || "").trim());
  if (!svc) return { error: "no such service", status: 404 };
  const dedupKey = String(body?.dedup_key || "").trim();
  if (!dedupKey) return { error: "dedup_key is required: without one every repeat of an alert opens a new incident", status: 422 };
  const severity = String(body?.severity || "").trim();
  if (rank(severity) < 0) return { error: `severity must be one of ${SEVERITIES.join(", ")}`, status: 422 };
  const summary = String(body?.summary || "").trim();
  if (summary.length < 4) return { error: "summary is required, and is the line a responder reads at 03:00", status: 422 };
  return { svc, dedupKey, severity, summary };
}

/** A repeat joins what is already open. It pages nobody a second time unless it
 *  is worse than what was accepted, because a monitor firing every thirty
 *  seconds must not become a phone ringing every thirty seconds. */
function absorb(db, open, alert, atMs) {
  alert.incident_id = open.id;
  open.alert_count += 1;
  open.last_alert_ms = atMs;
  log(open, atMs, "alert", null, `repeat ${open.alert_count} of ${alert.dedup_key}`);
  if (rank(alert.severity) > rank(open.severity)) {
    const from = open.severity;
    open.severity = alert.severity;
    log(open, atMs, "raised", null, `${from} to ${alert.severity}`);
    notify.send(db, { incident: open, responderId: open.assignee_id, reason: "raise", atMs, note: `${from} to ${alert.severity}` });
  }
  return { incident: open, created: false, alert };
}

function opened(db, svc, alert, atMs) {
  const policy = policyById(db, svc.policy_id);
  const oncall = onCallForService(db, svc.id, atMs);
  const n = nextId(db, "incident");
  const incident = {
    id: `I${n}`,
    key: `INC-${n}`,
    key_hash: alert.dedup_key,
    service_id: svc.id,
    service_key: svc.key,
    severity: alert.severity,
    summary: alert.summary,
    state: "triggered",
    opened_ms: atMs,
    last_alert_ms: atMs,
    acked_ms: null,
    resolved_ms: null,
    ack_by: null,
    assignee_id: oncall,
    step: 0,
    next_escalation_ms: dueAt(policy, 1, atMs),
    snoozed_until_ms: null,
    escalation_shift_ms: 0,
    alert_count: 1,
    timeline: [],
  };
  alert.incident_id = incident.id;
  db.incidents.push(incident);
  log(incident, atMs, "opened", null, `${alert.severity} on ${svc.key}`);
  const target = targetOf(db, stepAt(policy, 0), svc.rotation_id, atMs) ?? oncall;
  if (target) incident.assignee_id = target;
  log(incident, atMs, "paged", target, "step 0");
  notify.send(db, { incident, responderId: target, reason: "page", atMs, note: "step 0" });
  return { incident, created: true, alert };
}

/** The intake. Returns `{ incident, created, alert }`, or `{ error }` with the
 *  reason a monitor can act on. */
export function intake(db, body, atMs) {
  const v = validated(db, body);
  if (v.error) return v;
  const alert = {
    id: `A${nextId(db, "alert")}`, service_id: v.svc.id, dedup_key: v.dedupKey,
    severity: v.severity, summary: v.summary, received_ms: atMs, incident_id: null,
  };
  db.alerts.push(alert);
  const open = db.incidents.find((i) => i.service_id === v.svc.id && i.key_hash === v.dedupKey && isOpen(i));
  return open ? absorb(db, open, alert, atMs) : opened(db, v.svc, alert, atMs);
}

export function acknowledge(db, incident, actor, atMs) {
  if (incident.state === "resolved") return { error: "a resolved incident cannot be acknowledged", status: 409 };
  if (incident.state === "acknowledged") return { error: `already acknowledged by ${incident.ack_by}`, status: 409 };
  incident.state = "acknowledged";
  incident.acked_ms = atMs;
  incident.ack_by = actor.responder_id;
  incident.assignee_id = actor.responder_id;
  // Acknowledgement is the whole point of the escalation clock: somebody has it.
  incident.next_escalation_ms = null;
  incident.snoozed_until_ms = null;
  log(incident, atMs, "acknowledged", actor.responder_id);
  return { incident };
}

export function resolve(db, incident, actor, atMs, note = "") {
  if (incident.state === "resolved") return { error: "already resolved", status: 409 };
  const wasAssigned = incident.assignee_id;
  incident.state = "resolved";
  incident.resolved_ms = atMs;
  incident.next_escalation_ms = null;
  incident.snoozed_until_ms = null;
  log(incident, atMs, "resolved", actor.responder_id, note);
  // Somebody else closing your incident is something you find out now, not at
  // the next handoff.
  if (wasAssigned && wasAssigned !== actor.responder_id) {
    notify.send(db, { incident, responderId: wasAssigned, reason: "resolve", atMs, note: `resolved by ${actor.responder_id}` });
  }
  return { incident };
}

export function snooze(db, incident, actor, mins, atMs) {
  if (incident.state !== "triggered") return { error: "only a triggered incident can be snoozed; an acknowledged one already has an owner", status: 409 };
  const n = Math.trunc(Number(mins));
  if (!Number.isFinite(n) || n < 1 || n > 1440) return { error: "minutes must be a whole number between 1 and 1440", status: 422 };
  const until = atMs + n * 60_000;
  incident.snoozed_until_ms = until;
  // The whole policy moves, not just the next step. Postponing one step would
  // wake somebody at the snooze end and then fire every later step at once,
  // out of order, because those were still measured from the open instant.
  incident.escalation_shift_ms = (incident.escalation_shift_ms || 0) + n * 60_000;
  if (incident.next_escalation_ms !== null) incident.next_escalation_ms = dueFor(db, incident, incident.step + 1);
  log(incident, atMs, "snoozed", actor.responder_id, `${n} minutes`);
  return { incident };
}

export function reassign(db, incident, actor, responderId, atMs) {
  if (incident.state === "resolved") return { error: "a resolved incident cannot be reassigned", status: 409 };
  const to = db.responders.find((r) => r.id === responderId || r.handle === responderId);
  if (!to) return { error: "no such responder", status: 404 };
  incident.assignee_id = to.id;
  log(incident, atMs, "assigned", actor.responder_id, `to ${to.handle}`);
  notify.send(db, { incident, responderId: to.id, reason: "assignment", atMs, note: `assigned by ${actor.responder_id}` });
  return { incident };
}

/** A commander may lower a severity as well as raise it: triage is the job, and
 *  a board where nothing is ever downgraded is a board nobody trusts. */
export function setSeverity(db, incident, actor, severity, atMs) {
  if (rank(severity) < 0) return { error: `severity must be one of ${SEVERITIES.join(", ")}`, status: 422 };
  if (incident.state === "resolved") return { error: "a resolved incident keeps the severity it was resolved at", status: 409 };
  if (severity === incident.severity) return { error: `already ${severity}`, status: 409 };
  const from = incident.severity;
  const raised = rank(severity) > rank(from);
  incident.severity = severity;
  log(incident, atMs, raised ? "raised" : "lowered", actor.responder_id, `${from} to ${severity}`);
  if (raised) notify.send(db, { incident, responderId: incident.assignee_id, reason: "raise", atMs, note: `${from} to ${severity}` });
  return { incident };
}

/** What a client sees. The stored row carries the dedup key under `key_hash`
 *  and that is intake's business, not the console's. */
export function view(db, i, { timeline = false } = {}) {
  const who = (id) => db.responders.find((r) => r.id === id)?.handle ?? null;
  const out = {
    id: i.id, key: i.key, service: i.service_key, severity: i.severity, summary: i.summary,
    state: i.state, dedup_key: i.key_hash, alert_count: i.alert_count,
    opened_ms: i.opened_ms, acked_ms: i.acked_ms, resolved_ms: i.resolved_ms,
    assignee: who(i.assignee_id), assignee_id: i.assignee_id, ack_by: who(i.ack_by),
    step: i.step, next_escalation_ms: i.next_escalation_ms, snoozed_until_ms: i.snoozed_until_ms,
  };
  if (timeline) out.timeline = i.timeline.map((e) => ({ ...e, by: who(e.by) ?? e.by }));
  return out;
}
