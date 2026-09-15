// stats.js — the two numbers an on-call review argues about, computed the same
// way every time.
//
// MTTA is measured from the instant the incident OPENED, not from the last page
// it sent. Measuring from the last page is how a service that escalated three
// times reports a two-minute acknowledgement: the number improves every time
// the product gets worse.
//
// Both are whole seconds over the incidents that reached that state. An average
// over an empty set is null rather than 0, because 0 reads as "instant".
import { SEVERITIES } from "./incidents.js";

const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const seconds = (ms) => Math.round(ms / 1000);

export function summarise(db, nowMs) {
  const open = db.incidents.filter((i) => i.state !== "resolved");
  const acked = db.incidents.filter((i) => i.acked_ms !== null);
  const closed = db.incidents.filter((i) => i.state === "resolved" && i.resolved_ms !== null);
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, open.filter((i) => i.severity === s).length]));

  return {
    now_ms: nowMs,
    open: open.length,
    triggered: open.filter((i) => i.state === "triggered").length,
    acknowledged: open.filter((i) => i.state === "acknowledged").length,
    resolved: closed.length,
    open_by_severity: bySeverity,
    unacknowledged_oldest_s: Math.max(0, ...open.flatMap((i) => (i.acked_ms === null ? [seconds(nowMs - i.opened_ms)] : []))),
    mtta_s: mean(acked.map((i) => seconds(i.acked_ms - i.opened_ms))),
    mttr_s: mean(closed.map((i) => seconds(i.resolved_ms - i.opened_ms))),
    escalated_share_pct: closed.length
      ? Math.round((closed.filter((i) => i.step > 0).length / closed.length) * 100)
      : null,
    alerts: db.alerts.length,
    pages: db.notifications.length,
  };
}
