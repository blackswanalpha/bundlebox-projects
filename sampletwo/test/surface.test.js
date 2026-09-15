// surface.test.js — the surface, called as values rather than over a socket.
//
// These call `handle()` directly, which is the same function the HTTP server
// calls. A test that goes through a socket is testing the socket; a test that
// reaches past `handle` into the modules is testing an arrangement no client
// can reach. The scenario corpus covers the wire.
import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const DB = path.join(os.tmpdir(), `sampletwo-test-${process.pid}.json`);
process.env.SAMPLETWO_DB = DB;

const { handle, ROUTES } = await import("../src/server.js");
const { reset } = await import("../src/store.js");
const { seed, T0 } = await import("../src/seed.js");
const { onCallAt } = await import("../src/schedule.js");

const as = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const call = (method, target, opts = {}) => handle(method, target, opts);

let tokens = {};

async function tokenFor(email) {
  const r = await call("POST", "/auth/token", { body: { email } });
  assert.equal(r.status, 200, `token for ${email}`);
  return r.body.token;
}

before(async () => { reset(seed()); });
after(() => { try { fs.unlinkSync(DB); } catch { /* the temp file may already be gone */ } });

beforeEach(async () => {
  reset(seed());
  tokens = {
    nadia: await tokenFor("nadia@relay.test"),
    tomas: await tokenFor("tomas@relay.test"),
    imani: await tokenFor("imani@relay.test"),
    wren: await tokenFor("wren@relay.test"),
  };
});

const page = (body, token = tokens.nadia) => call("POST", "/alerts", { ...as(token), body });
const advance = (minutes) => call("POST", "/admin/clock", { ...as(tokens.wren), body: { advance_minutes: minutes } });

describe("health and identity", () => {
  it("says what it is and which clock it is on", async () => {
    const r = await call("GET", "/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.service, "sampletwo");
    assert.equal(r.body.clock, "virtual");
    assert.equal(r.body.now_ms, T0);
  });

  it("refuses a token for an address nobody added to the directory", async () => {
    assert.equal((await call("POST", "/auth/token", { body: { email: "ghost@relay.test" } })).status, 404);
    assert.equal((await call("POST", "/auth/token", { body: { email: "not-an-address" } })).status, 422);
  });

  it("issues a commander a commander's token", async () => {
    const r = await call("POST", "/auth/token", { body: { email: "wren@relay.test" } });
    assert.equal(r.body.role, "commander");
    assert.equal(r.body.handle, "wren");
  });
});

describe("intake", () => {
  const alert = { service: "billing-jobs", dedup_key: "invoice-lag", severity: "sev2", summary: "Invoice generation 22 minutes behind" };

  it("opens an incident and pages whoever is on call for that service", async () => {
    const r = await page(alert);
    assert.equal(r.status, 201);
    assert.equal(r.body.deduped, false);
    assert.equal(r.body.incident.state, "triggered");
    // billing-jobs runs on the platform rotation, where imani holds the pager.
    assert.equal(r.body.incident.assignee, "imani");
    const notes = await call("GET", `/notifications?incident=${r.body.incident.key}`);
    assert.equal(notes.body.total, 1);
    assert.equal(notes.body.items[0].reason, "page");
  });

  it("refuses an alert with no dedup key, and one with an unknown severity", async () => {
    assert.equal((await page({ ...alert, dedup_key: "" })).status, 422);
    assert.equal((await page({ ...alert, severity: "urgent" })).status, 422);
    assert.equal((await page({ ...alert, service: "nope" })).status, 404);
    assert.equal((await call("POST", "/alerts", { body: alert })).status, 401);
  });

  it("joins a repeat to the open incident instead of opening a second", async () => {
    const first = await page(alert);
    const second = await page(alert);
    assert.equal(second.status, 200);
    assert.equal(second.body.deduped, true);
    assert.equal(second.body.incident.key, first.body.incident.key);
    assert.equal(second.body.incident.alert_count, 2);
    const notes = await call("GET", `/notifications?incident=${first.body.incident.key}`);
    assert.equal(notes.body.total, 1, "a repeat at the same severity pages nobody twice");
  });

  it("raises and pages again when the repeat is worse than what was accepted", async () => {
    const first = await page(alert);
    const worse = await page({ ...alert, severity: "sev1" });
    assert.equal(worse.body.incident.severity, "sev1");
    const notes = await call("GET", `/notifications?incident=${first.body.incident.key}`);
    assert.equal(notes.body.total, 2);
    assert.equal(notes.body.items[1].reason, "raise");
  });

  it("never lowers an incident on a quieter repeat", async () => {
    await page({ ...alert, severity: "sev1" });
    const quieter = await page({ ...alert, severity: "sev3" });
    assert.equal(quieter.body.incident.severity, "sev1");
  });

  it("opens a new incident when the same symptom returns after a resolve", async () => {
    const first = await page(alert);
    await call("POST", `/incidents/${first.body.incident.key}/resolve`, { ...as(tokens.imani), body: {} });
    const again = await page(alert);
    assert.equal(again.status, 201);
    assert.notEqual(again.body.incident.key, first.body.incident.key);
  });
});

describe("who may answer a page", () => {
  it("lets the on-call acknowledge, and refuses a responder who is neither on call nor assigned", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "latency-p99", severity: "sev2", summary: "p99 above 2s for 6 minutes" });
    const key = r.body.incident.key;
    assert.equal(r.body.incident.assignee, "nadia");

    assert.equal((await call("POST", `/incidents/${key}/ack`)).status, 401);
    assert.equal((await call("POST", `/incidents/${key}/ack`, as(tokens.tomas))).status, 403);

    const ok = await call("POST", `/incidents/${key}/ack`, as(tokens.nadia));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.state, "acknowledged");
    assert.equal(ok.body.ack_by, "nadia");
  });

  it("answers a second acknowledgement with a conflict and keeps the first instant", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "queue-stall", severity: "sev2", summary: "Worker queue stalled" });
    const key = r.body.incident.key;
    const first = await call("POST", `/incidents/${key}/ack`, as(tokens.nadia));
    await advance(3);
    const second = await call("POST", `/incidents/${key}/ack`, as(tokens.wren));
    assert.equal(second.status, 409);
    const now = await call("GET", `/incidents/${key}`);
    assert.equal(now.body.acked_ms, first.body.acked_ms);
  });

  it("keeps severity and assignment to a commander", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "cache-miss", severity: "sev3", summary: "Cache hit rate down to 41%" });
    const key = r.body.incident.key;
    assert.equal((await call("POST", `/incidents/${key}/severity`, { ...as(tokens.nadia), body: { severity: "sev1" } })).status, 403);
    const up = await call("POST", `/incidents/${key}/severity`, { ...as(tokens.wren), body: { severity: "sev1" } });
    assert.equal(up.status, 200);
    assert.equal(up.body.severity, "sev1");
    const moved = await call("POST", `/incidents/${key}/assign`, { ...as(tokens.wren), body: { responder: "tomas" } });
    assert.equal(moved.body.assignee, "tomas");
  });
});

describe("escalation runs on the clock", () => {
  it("reaches the next name in the rotation when nobody acknowledges", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "5xx-rate", severity: "sev1", summary: "5xx rate above 2%" });
    const key = r.body.incident.key;
    assert.equal(r.body.incident.step, 0);

    const quiet = await advance(4);
    assert.deepEqual(quiet.body.fired, [], "step 1 is due at five minutes, not at four");

    const fired = await advance(2);
    const mine = fired.body.fired.filter((f) => f.incident === key);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].kind, "escalation");
    assert.equal(mine[0].step, 1);
    const after = await call("GET", `/incidents/${key}`);
    assert.equal(after.body.assignee, "tomas");
  });

  it("stops escalating the moment somebody takes it", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "disk-full", severity: "sev1", summary: "Disk at 97% on two nodes" });
    const key = r.body.incident.key;
    await call("POST", `/incidents/${key}/ack`, as(tokens.nadia));
    const later = await advance(30);
    assert.deepEqual(later.body.fired.filter((f) => f.incident === key), []);
    const after = await call("GET", `/incidents/${key}`);
    assert.equal(after.body.step, 0);
    assert.equal(after.body.next_escalation_ms, null);
  });

  it("fires every step a long jump passed, in order", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "oom-loop", severity: "sev1", summary: "Pods restarting on OOM" });
    const key = r.body.incident.key;
    const jump = await advance(20);
    const mine = jump.body.fired.filter((f) => f.incident === key);
    assert.deepEqual(mine.map((f) => f.step), [1, 2]);
    assert.ok(mine[0].at_ms < mine[1].at_ms, "the earlier step carries the earlier instant");
    const after = await call("GET", `/incidents/${key}`);
    assert.equal(after.body.assignee, "wren", "the last step of tier 1 is the commander");
    assert.equal(after.body.next_escalation_ms, null, "a policy that has run out stops rather than repeating");
  });

  it("reaches whoever holds the pager when the step fires, not when the incident opened", async () => {
    // The core rotation hands over six hours after the seed instant, and
    // search-index escalates once, to whoever is next up. Opened now, "next"
    // means tomas. Fired after the handoff it must mean imani, because by then
    // tomas is the one holding the pager.
    const r = await page({ service: "search-index", dedup_key: "handoff-case", severity: "sev2", summary: "Index lag climbing again" });
    const key = r.body.incident.key;
    assert.equal(r.body.incident.assignee, "nadia");
    await call("POST", `/incidents/${key}/snooze`, { ...as(tokens.nadia), body: { minutes: 400 } });
    await advance(401);
    await advance(20);
    const after = await call("GET", `/incidents/${key}`);
    assert.equal(after.body.assignee, "imani", "the shift after the handoff, not the one that was on call at open");
  });
});

describe("snooze", () => {
  it("delays the next step and pages again when it expires", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "slow-query", severity: "sev1", summary: "Query p95 above 900ms" });
    const key = r.body.incident.key;
    const snoozed = await call("POST", `/incidents/${key}/snooze`, { ...as(tokens.nadia), body: { minutes: 20 } });
    assert.equal(snoozed.status, 200);
    assert.ok(snoozed.body.snoozed_until_ms > snoozed.body.opened_ms);

    const quiet = await advance(10);
    assert.deepEqual(quiet.body.fired.filter((f) => f.incident === key), [], "a snoozed incident does not escalate");

    const woke = await advance(11);
    const mine = woke.body.fired.filter((f) => f.incident === key);
    assert.equal(mine[0].kind, "snooze-expired");
    const notes = await call("GET", `/notifications?incident=${key}`);
    assert.ok(notes.body.items.some((n) => n.reason === "snooze-expired"));
  });

  it("moves every later step, so none of them fires behind the one it delayed", async () => {
    // Found by the scenario corpus against the running service: shifting only
    // the next step left steps 2 and 3 measured from the open instant, so they
    // fired in the same tick as the delayed step and carried earlier instants
    // than it.
    const r = await page({ service: "checkout-api", dedup_key: "replica-lag", severity: "sev1", summary: "Replica 40 minutes behind" });
    const key = r.body.incident.key;
    await call("POST", `/incidents/${key}/snooze`, { ...as(tokens.nadia), body: { minutes: 20 } });
    await advance(21);
    const first = (await advance(5)).body.fired.filter((f) => f.incident === key);
    assert.deepEqual(first.map((f) => f.step), [1], "step 1 was due at five minutes, delayed by twenty");
    const second = (await advance(10)).body.fired.filter((f) => f.incident === key);
    assert.deepEqual(second.map((f) => f.step), [2]);
    assert.ok(second[0].at_ms > first[0].at_ms, "a later step never carries an earlier instant");
  });

  it("refuses to snooze what somebody already owns, and refuses a nonsense duration", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "tls-handshake", severity: "sev2", summary: "TLS handshake failures on one edge" });
    const key = r.body.incident.key;
    assert.equal((await call("POST", `/incidents/${key}/snooze`, { ...as(tokens.nadia), body: { minutes: 0 } })).status, 422);
    await call("POST", `/incidents/${key}/ack`, as(tokens.nadia));
    assert.equal((await call("POST", `/incidents/${key}/snooze`, { ...as(tokens.nadia), body: { minutes: 10 } })).status, 409);
  });
});

describe("resolve and the numbers a review reads", () => {
  it("closes once, and says so the second time", async () => {
    const r = await page({ service: "checkout-api", dedup_key: "cert-rotate", severity: "sev2", summary: "Certificate rotation failed on one node" });
    const key = r.body.incident.key;
    await call("POST", `/incidents/${key}/ack`, as(tokens.nadia));
    await advance(9);
    const done = await call("POST", `/incidents/${key}/resolve`, { ...as(tokens.nadia), body: { note: "rotated by hand" } });
    assert.equal(done.status, 200);
    assert.equal(done.body.state, "resolved");
    assert.equal((await call("POST", `/incidents/${key}/resolve`, { ...as(tokens.nadia), body: {} })).status, 409);
    const t = done.body.timeline.filter((e) => e.kind === "resolved");
    assert.equal(t.length, 1, "the timeline is append-only and a refused resolve writes nothing");
  });

  it("measures acknowledgement from the moment the incident opened", async () => {
    const r = await page({ service: "media-cdn", dedup_key: "origin-5xx", severity: "sev2", summary: "Origin returning 5xx for 3% of requests" });
    const key = r.body.incident.key;
    await advance(4);
    await call("POST", `/incidents/${key}/ack`, as(tokens.imani));
    const stats = await call("GET", "/stats");
    // The seed carries two acknowledgements at 120s and 60s; this one adds 240s.
    assert.equal(stats.body.mtta_s, 140);
    assert.equal(stats.body.open, 4, "acknowledged is not closed");
  });

  it("reports an average over nothing as null rather than as nought", async () => {
    const fresh = reset(seed());
    fresh.incidents = [];
    fresh.alerts = [];
    fresh.notifications = [];
    const { write } = await import("../src/store.js");
    write(fresh);
    const stats = await call("GET", "/stats");
    assert.equal(stats.body.mttr_s, null);
    assert.equal(stats.body.mtta_s, null);
    assert.equal(stats.body.escalated_share_pct, null);
  });
});

describe("the surface itself", () => {
  it("separates a route that does not exist from a method that route does not answer", async () => {
    assert.equal((await call("GET", "/nope")).status, 404);
    const wrong = await call("DELETE", "/incidents/INC-4001");
    assert.equal(wrong.status, 405);
    assert.match(wrong.body.allow, /GET/);
  });

  it("holds one row per route, and lets no row shadow the one below it", async () => {
    const seen = new Set();
    const sampleOf = (re) => re.source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\\//g, "/").replace(/\(\[\\w-\]\+\)/g, "x1");
    for (const row of ROUTES) {
      const [method, re] = row;
      const key = `${method} ${re.source}`;
      assert.equal(seen.has(key), false, `${key} is in the table twice`);
      seen.add(key);
      // The router takes every row whose PATH matches, then the one whose
      // method does. A row that another row answers first is unreachable, which
      // is how `DELETE /a/:id` disappears under the `PATCH` row above it.
      const sample = sampleOf(re);
      assert.equal(re.test(sample), true, `${sample} does not match its own row`);
      const chosen = ROUTES.filter(([, r]) => r.test(sample)).find(([verb]) => verb === method);
      assert.equal(chosen, row, `${method} ${sample} is answered by ${chosen?.[1]?.source}`);
    }
  });

  it("answers who is on call at an instant, including before the rotation started", async () => {
    const db = seed();
    assert.equal(onCallAt(db, "ROT-core", T0), "R1");
    assert.equal(onCallAt(db, "ROT-core", T0 - 9 * 3_600_000), "R3", "a shift before the start instant still has a holder");
    const r = await call("GET", `/oncall?at=${T0 + 7 * 3_600_000}`);
    assert.equal(r.body.rotations.find((x) => x.rotation_id === "ROT-core").on_call, "tomas");
  });

  it("filters the board without paging anybody", async () => {
    const all = await call("GET", "/incidents");
    assert.equal(all.body.total, 4);
    assert.equal(all.body.items[0].key, "INC-4004", "newest first");
    assert.equal((await call("GET", "/incidents?state=resolved")).body.total, 1);
    assert.equal((await call("GET", "/incidents?severity=sev1")).body.total, 1);
    assert.equal((await call("GET", "/incidents?service=docs-site")).body.total, 1);
  });
});
