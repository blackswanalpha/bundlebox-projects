// server.js — the HTTP surface, and the only file that knows about HTTP.
//
// Every handler returns `{status, body}` and this file turns that into a
// response. That split is what lets `test/` call the handlers directly and the
// scenario corpus call them over the wire, and get the same answers from both.
//
// Reads are open and writes are not. A wallboard on a screen in the room is the
// point of a service like this, and it should not need a token to render; a
// page that anybody can send, acknowledge or close is a pager nobody answers.
//
// Logging is one line per request in a fixed shape, because `bb runbook logs`
// reads these by signature: a request line whose variable parts are a path, a
// status and a duration collapses to one row per route no matter how often it
// is called.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { advance, iso, now, VIRTUAL } from "./clock.js";
import { bearer, issue, mayAnswer } from "./auth.js";
import { read, reset, write } from "./store.js";
import { seed } from "./seed.js";
import { tick } from "./engine.js";
import * as incidents from "./incidents.js";
import * as notify from "./notify.js";
import * as policy from "./policy.js";
import * as schedule from "./schedule.js";
import * as stats from "./stats.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "1.0.0";
const STARTED = Date.now();

const json = (status, body) => ({ status, body });
const problem = (status, why, extra = {}) => json(status, { error: why, ...extra });

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

/** The route table. One row per route so the surface is readable in one place,
 *  and so a route no scenario touches is a gap the board can report rather than
 *  a gap nobody notices. */
export const ROUTES = [
  ["GET", /^\/health$/, health],
  ["POST", /^\/auth\/token$/, token],
  ["GET", /^\/services$/, listServices],
  ["GET", /^\/services\/([\w-]+)$/, getService],
  ["GET", /^\/oncall$/, oncall],
  ["GET", /^\/policies$/, listPolicies],
  ["POST", /^\/alerts$/, postAlert],
  ["GET", /^\/incidents$/, listIncidents],
  ["GET", /^\/incidents\/([\w-]+)$/, getIncident],
  ["POST", /^\/incidents\/([\w-]+)\/ack$/, ackIncident],
  ["POST", /^\/incidents\/([\w-]+)\/resolve$/, resolveIncident],
  ["POST", /^\/incidents\/([\w-]+)\/snooze$/, snoozeIncident],
  ["POST", /^\/incidents\/([\w-]+)\/assign$/, assignIncident],
  ["POST", /^\/incidents\/([\w-]+)\/severity$/, severityIncident],
  ["GET", /^\/notifications$/, listNotifications],
  ["GET", /^\/stats$/, getStats],
  ["POST", /^\/admin\/clock$/, adminClock],
  ["POST", /^\/admin\/reset$/, adminReset],
];

/** Deadlines are instants, so the board is only current if something compares
 *  them to the clock before answering. Doing it on the way in means a page that
 *  came due four minutes ago is never still sitting in a queue when somebody
 *  asks what is open. */
function settle() {
  const db = read();
  const fired = tick(db, now());
  if (fired.length) write(db);
  return fired;
}

function health() {
  const db = read();
  return json(200, {
    ok: true, service: "sampletwo", version: VERSION,
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
    clock: VIRTUAL ? "virtual" : "wall", now_ms: db.clock_ms, now: iso(now()),
    open: db.incidents.filter((i) => i.state !== "resolved").length,
    services: db.services.length,
  });
}

/** Relay does not create responders at the door. A pager token handed to an
 *  address nobody added to the directory is an escalation target that no
 *  rotation contains and no review can explain. */
function token(req, m, body) {
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return problem(422, "email must look like an address");
  const r = read().responders.find((x) => x.email === email);
  if (!r) return problem(404, "no such responder; add them to the directory before they can be paged");
  return json(200, { token: issue(r.id, r.role), responder_id: r.id, handle: r.handle, name: r.name, role: r.role });
}

const actorOr401 = (req) => {
  const actor = bearer(req);
  return actor ? { actor } : { deny: problem(401, "a bearer token is required") };
};

const commanderOr403 = (req) => {
  const { actor, deny } = actorOr401(req);
  if (deny) return { deny };
  if (actor.role !== "commander") return { deny: problem(403, "only an incident commander may do this") };
  return { actor };
};

function listServices() {
  const db = read();
  const at = now();
  return json(200, {
    items: db.services.map((s) => ({
      id: s.id, key: s.key, name: s.name, tier: s.tier,
      rotation: s.rotation_id, policy: s.policy_id,
      on_call: db.responders.find((r) => r.id === schedule.onCallForService(db, s.id, at))?.handle ?? null,
      open: db.incidents.filter((i) => i.service_id === s.id && i.state !== "resolved").length,
    })),
  });
}

function getService(req, m) {
  const db = read();
  const s = db.services.find((x) => x.key === m[1] || x.id === m[1]);
  if (!s) return problem(404, "no such service");
  return json(200, {
    ...s,
    on_call: db.responders.find((r) => r.id === schedule.onCallForService(db, s.id, now()))?.handle ?? null,
    policy: policy.describe(db, s.policy_id),
  });
}

function oncall(req, m, body, url) {
  const at = url.searchParams.has("at") ? Number(url.searchParams.get("at")) : now();
  if (!Number.isFinite(at)) return problem(422, "at must be a millisecond instant");
  const db = read();
  const who = (id) => db.responders.find((r) => r.id === id) ?? null;
  return json(200, {
    at_ms: at, at: iso(at),
    rotations: schedule.board(at).map((r) => ({
      ...r,
      on_call: who(r.on_call)?.handle ?? null,
      next_up: who(r.next_up)?.handle ?? null,
      handoff: r.handoff_ms === null ? null : iso(r.handoff_ms),
      handoff_in_s: r.handoff_ms === null ? null : Math.round((r.handoff_ms - at) / 1000),
    })),
    directory: db.responders.map((r) => ({ id: r.id, handle: r.handle, name: r.name, role: r.role })),
  });
}

function listPolicies() {
  const db = read();
  return json(200, { items: db.policies.map((p) => policy.describe(db, p.id)) });
}

function postAlert(req, m, body) {
  const { deny } = actorOr401(req);
  if (deny) return deny;
  const db = read();
  const r = incidents.intake(db, body, now());
  if (r.error) return problem(r.status, r.error);
  write(db);
  return json(r.created ? 201 : 200, {
    deduped: !r.created, alert_id: r.alert.id, incident: incidents.view(db, r.incident),
  });
}

function listIncidents(req, m, body, url) {
  settle();
  const db = read();
  const q = url.searchParams;
  const want = (key, get) => { const v = q.get(key); return v === null || v === "" ? null : get(v); };
  const state = want("state", String);
  const service = want("service", String);
  const severity = want("severity", String);
  const assignee = want("assignee", String);
  let items = db.incidents.filter((i) =>
    (state === null || i.state === state) &&
    (service === null || i.service_key === service) &&
    (severity === null || i.severity === severity) &&
    (assignee === null || db.responders.find((r) => r.id === i.assignee_id)?.handle === assignee));
  // Newest first: a queue that puts the oldest at the top buries the page that
  // just fired under the one somebody is already working.
  items = items.sort((a, b) => b.opened_ms - a.opened_ms);
  const limit = Math.min(200, Math.max(1, Number(q.get("limit") || 50)));
  return json(200, {
    now_ms: now(), total: items.length,
    items: items.slice(0, limit).map((i) => incidents.view(db, i)),
  });
}

function getIncident(req, m) {
  settle();
  const db = read();
  const i = incidents.byId(db, m[1]);
  if (!i) return problem(404, "no such incident");
  return json(200, { now_ms: now(), ...incidents.view(db, i, { timeline: true }) });
}

/** The one authorisation check that matters. A responder answers what is
 *  theirs and what they are on call for; everything else is 403, and no token
 *  at all is 401. Merging the two would log a broken console as an intruder. */
function withIncident(req, key, fn) {
  const { actor, deny } = actorOr401(req);
  if (deny) return deny;
  settle();
  const db = read();
  const inc = incidents.byId(db, key);
  if (!inc) return problem(404, "no such incident");
  const onCallId = schedule.onCallForService(db, inc.service_id, now());
  if (!mayAnswer(actor, inc, onCallId)) {
    return problem(403, "this incident is not yours and you are not on call for it", { assignee: inc.assignee_id, on_call: onCallId });
  }
  const r = fn(db, inc, actor);
  if (r.error) return problem(r.status, r.error);
  write(db);
  return json(200, incidents.view(db, inc, { timeline: true }));
}

function ackIncident(req, m) {
  return withIncident(req, m[1], (db, inc, actor) => incidents.acknowledge(db, inc, actor, now()));
}

function resolveIncident(req, m, body) {
  return withIncident(req, m[1], (db, inc, actor) => incidents.resolve(db, inc, actor, now(), String(body?.note || "")));
}

function snoozeIncident(req, m, body) {
  return withIncident(req, m[1], (db, inc, actor) => incidents.snooze(db, inc, actor, body?.minutes, now()));
}

function assignIncident(req, m, body) {
  const { deny } = commanderOr403(req);
  if (deny) return deny;
  return withIncident(req, m[1], (db, inc, actor) => incidents.reassign(db, inc, actor, String(body?.responder || ""), now()));
}

function severityIncident(req, m, body) {
  const { deny } = commanderOr403(req);
  if (deny) return deny;
  return withIncident(req, m[1], (db, inc, actor) => incidents.setSeverity(db, inc, actor, String(body?.severity || ""), now()));
}

function listNotifications(req, m, body, url) {
  settle();
  const db = read();
  const forId = url.searchParams.get("incident");
  const who = (id) => db.responders.find((r) => r.id === id)?.handle ?? id;
  let items = db.notifications;
  if (forId) {
    const inc = incidents.byId(db, forId);
    items = inc ? notify.forIncident(db, inc.id) : [];
  }
  return json(200, {
    total: items.length,
    items: items.slice(-100).map((n) => ({ ...n, responder: who(n.responder_id), at: iso(n.at_ms) })),
  });
}

function getStats() {
  settle();
  return json(200, stats.summarise(read(), now()));
}

/** Moving the clock is an operational act, so it is a commander's. It returns
 *  what fired, which is how a scenario asserts on an escalation without reading
 *  a log file. */
function adminClock(req, m, body) {
  const { deny } = commanderOr403(req);
  if (deny) return deny;
  if (!VIRTUAL) return problem(409, "this deployment runs on the wall clock and cannot be advanced");
  const mins = body?.advance_minutes;
  if (mins === undefined) return problem(422, "advance_minutes is required");
  const ms = Math.trunc(Number(mins) * 60_000);
  if (!Number.isFinite(ms) || ms < 0) return problem(422, "advance_minutes must be a number of minutes, and time runs forward");
  advance(ms);
  const fired = settle();
  return json(200, { now_ms: now(), now: iso(now()), advanced_minutes: Number(mins), fired });
}

function adminReset(req) {
  const { deny } = commanderOr403(req);
  if (deny) return deny;
  reset(seed());
  const db = read();
  return json(200, { ok: true, now_ms: db.clock_ms, incidents: db.incidents.length, services: db.services.length, responders: db.responders.length });
}

/** One request, as a value. Exported so the tests can call the surface without
 *  a socket and get the same answer the corpus gets over one. */
export async function handle(method, target, { headers = {}, body = null } = {}) {
  const url = new URL(target, "http://127.0.0.1");
  // Every row whose PATH matches, then the one whose method does. Returning 405
  // from the first path match would mean a route that exists is answered by the
  // row sitting above it.
  const onPath = ROUTES.filter(([, re]) => re.test(url.pathname));
  if (!onPath.length) return problem(404, `no route for ${method} ${url.pathname}`);
  const row = onPath.find(([verb]) => verb === method);
  if (!row) return problem(405, `${url.pathname} does not answer ${method}`, { allow: onPath.map(([v]) => v).join(", ") });
  try { return await row[2]({ headers }, row[1].exec(url.pathname), body, url); }
  catch (e) { return problem(500, "the request could not be completed", { detail: String(e.message || e) }); }
}

function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.join(ROOT, "web", path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(path.join(ROOT, "web"))) { res.writeHead(403).end(); return true; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
  return true;
}

function create() {
  return http.createServer(async (req, res) => {
    const t0 = Date.now();
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = null;
    if (chunks.length) {
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "body is not JSON" })); return; }
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && serveStatic(url.pathname, res)) {
      log(req.method, url.pathname, 200, Date.now() - t0);
      return;
    }
    const r = await handle(req.method, req.url, { headers: req.headers, body });
    res.writeHead(r.status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(r.body));
    log(req.method, url.pathname, r.status, Date.now() - t0);
  });
}

// A fixed shape, so `bb runbook logs` collapses every call of one route into
// one row: method, path, status, duration. Nothing variable outside those.
const log = (method, pathname, status, ms) =>
  process.stdout.write(`${new Date().toISOString()} ${status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO"} ${method} ${pathname} ${status} ${ms}ms\n`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || process.argv.find((a) => a.startsWith("--port="))?.slice(7) || 8600);
  if (!read().services.length) reset(seed());
  create().listen(port, "127.0.0.1", () => process.stdout.write(`${new Date().toISOString()} INFO sampletwo ${VERSION} listening on 127.0.0.1:${port}\n`));
}
