// seed.js — a board with a history, built by replaying the real intake.
//
// The rows below are not written out by hand. Four incidents are put through
// `intake`, `acknowledge` and `resolve` at explicit instants and the tick is
// run once at the seed instant, so the seeded board is one the service could
// actually have reached. A hand-written fixture is a fixture that disagrees
// with the code the first time a rule changes.
import { EMPTY } from "./store.js";
import * as incidents from "./incidents.js";
import { tick } from "./engine.js";

export const T0 = Date.parse("2026-03-02T09:00:00Z");
const HOUR = 3_600_000;
const at = (mins) => T0 + Math.round(mins * 60_000);

export function seed() {
  const db = structuredClone(EMPTY);
  db.clock_ms = T0;

  db.responders = [
    { id: "R1", handle: "nadia", name: "Nadia Bekele", email: "nadia@relay.test", role: "responder" },
    { id: "R2", handle: "tomas", name: "Tomas Ferreira", email: "tomas@relay.test", role: "responder" },
    { id: "R3", handle: "imani", name: "Imani Wanjiru", email: "imani@relay.test", role: "responder" },
    { id: "R4", handle: "wren", name: "Wren Halloran", email: "wren@relay.test", role: "commander" },
  ];

  db.rotations = [
    { id: "ROT-core", name: "Core", members: ["R1", "R2", "R3"], shift_hours: 8, starts_ms: T0 - 2 * HOUR },
    { id: "ROT-platform", name: "Platform", members: ["R3", "R1"], shift_hours: 24, starts_ms: T0 - 3 * HOUR },
  ];

  db.policies = [
    { id: "P-tier1", name: "Tier 1", steps: [{ after_minutes: 0, target: "oncall" }, { after_minutes: 5, target: "next" }, { after_minutes: 15, target: "commander" }] },
    { id: "P-tier2", name: "Tier 2", steps: [{ after_minutes: 0, target: "oncall" }, { after_minutes: 15, target: "next" }] },
    { id: "P-tier3", name: "Tier 3", steps: [{ after_minutes: 0, target: "oncall" }] },
  ];

  db.services = [
    { id: "S1", key: "checkout-api", name: "Checkout API", tier: 1, rotation_id: "ROT-core", policy_id: "P-tier1" },
    { id: "S2", key: "payments-worker", name: "Payments worker", tier: 1, rotation_id: "ROT-core", policy_id: "P-tier1" },
    { id: "S3", key: "search-index", name: "Search index", tier: 2, rotation_id: "ROT-core", policy_id: "P-tier2" },
    { id: "S4", key: "media-cdn", name: "Media CDN", tier: 2, rotation_id: "ROT-platform", policy_id: "P-tier2" },
    { id: "S5", key: "billing-jobs", name: "Billing jobs", tier: 2, rotation_id: "ROT-platform", policy_id: "P-tier2" },
    { id: "S6", key: "docs-site", name: "Docs site", tier: 3, rotation_id: "ROT-platform", policy_id: "P-tier3" },
  ];

  const actor = (id) => ({ responder_id: id, role: db.responders.find((r) => r.id === id).role });
  const raise = (body, mins) => incidents.intake(db, body, at(mins)).incident;

  // One closed incident, so the review numbers on /stats are averages over
  // something rather than nulls.
  const closed = raise({ service: "payments-worker", dedup_key: "retry-queue-depth", severity: "sev2", summary: "Retry queue depth 4,812 and climbing" }, -185);
  incidents.acknowledge(db, closed, actor(closed.assignee_id), at(-183));
  incidents.resolve(db, closed, actor(closed.assignee_id), at(-144), "queue drained after the consumer was restarted");

  // A slow burn nobody has to wake up for: tier 3, one step, no escalation.
  raise({ service: "docs-site", dedup_key: "tls-expiry", severity: "sev3", summary: "TLS certificate expires in 13 days" }, -41);

  // Answered inside a minute, which is what the board should look like.
  const held = raise({ service: "search-index", dedup_key: "index-lag", severity: "sev2", summary: "Index lag 11 minutes behind primary" }, -9);
  incidents.acknowledge(db, held, actor(held.assignee_id), at(-8));

  // The live one: sev1, three alerts, unanswered long enough that the tick below
  // has already moved it to the second name in the rotation.
  const live = { service: "checkout-api", dedup_key: "checkout-5xx", severity: "sev1", summary: "Checkout 5xx rate above 2% for 4 minutes" };
  raise(live, -6);
  raise(live, -5);
  raise(live, -4);

  tick(db, T0);
  return db;
}
