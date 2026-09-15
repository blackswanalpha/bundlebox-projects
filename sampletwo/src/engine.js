// engine.js — the tick.
//
// Every deadline in this service is an instant in the store, and this file is
// the only thing that compares one to the clock. Nothing here runs on a timer:
// the tick is called when the clock moves and when the board is read, so the
// answer a client gets is never a page that was due four minutes ago and is
// still sitting in a queue.
//
// It returns what fired. `POST /admin/clock` reports that list, which is how a
// scenario asserts on an escalation without reading the log.
import { byId as policyById, stepAt, targetOf } from "./policy.js";
import * as incidents from "./incidents.js";
import * as notify from "./notify.js";

export function tick(db, atMs) {
  const fired = [];
  for (const inc of db.incidents) {
    if (inc.state !== "triggered") continue;
    const svc = db.services.find((s) => s.id === inc.service_id);
    if (!svc) continue;

    if (inc.snoozed_until_ms !== null && atMs >= inc.snoozed_until_ms) {
      inc.snoozed_until_ms = null;
      incidents.log(inc, atMs, "unsnoozed", inc.assignee_id);
      notify.send(db, { incident: inc, responderId: inc.assignee_id, reason: "snooze-expired", atMs });
      fired.push({ incident: inc.key, kind: "snooze-expired", responder: inc.assignee_id, at_ms: atMs });
      continue;
    }
    if (inc.snoozed_until_ms !== null) continue;

    const policy = policyById(db, svc.policy_id);
    // A clock that jumps an hour must fire every step it passed, in order, each
    // resolved against the rotation as it stood when that step came due.
    let guard = 0;
    while (inc.next_escalation_ms !== null && atMs >= inc.next_escalation_ms && guard++ < 64) {
      const at = inc.next_escalation_ms;
      const n = inc.step + 1;
      const step = stepAt(policy, n);
      if (!step) { inc.next_escalation_ms = null; break; }
      const target = targetOf(db, step, svc.rotation_id, at);
      inc.step = n;
      inc.assignee_id = target ?? inc.assignee_id;
      inc.next_escalation_ms = incidents.dueFor(db, inc, n + 1);
      incidents.log(inc, at, "escalated", target, `step ${n} to ${step.target}`);
      notify.send(db, { incident: inc, responderId: target, reason: "escalation", atMs: at, note: `step ${n}` });
      fired.push({ incident: inc.key, kind: "escalation", step: n, responder: target, at_ms: at });
    }
  }
  return fired;
}
