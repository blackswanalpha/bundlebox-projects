// server.js — the surface `bb cookbook` asserts against and `bb simulate` puts
// under load. Zero dependencies and one file of routing, so a red step is about
// the behaviour and never about a framework.
//
// Every route that can refuse says WHICH field was wrong and what was allowed.
// A 400 that says "invalid" costs the caller a session to diagnose, which is
// the cost this whole workspace exists to measure.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import * as tasks from "./tasks.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const started = Date.now();

const ROUTES = [
  // A root that answers. `bb simulate`'s default profile puts `GET /` under
  // load, and a service whose root 404s reports 100% errors under a load test
  // that never reached anything — a red board about the profile, not the
  // service. An index of the routes is the cheapest honest thing to serve.
  { method: "GET", re: /^\/$/, handle: () => ({ status: 200, body: {
      service: "tokenlab", uptime_s: Math.round((Date.now() - started) / 1000),
      routes: ROUTES.map((r) => `${r.method} ${String(r.re).replace(/^\/\^|\$\/$/g, "").replace(/\\\//g, "/")}`) } }) },
  { method: "GET", re: /^\/health$/, handle: () => ({ status: 200, body: { ok: true, service: "tokenlab", uptime_s: Math.round((Date.now() - started) / 1000) } }) },
  { method: "GET", re: /^\/tasks$/, handle: () => ({ status: 200, body: store.all().map(tasks.project) }) },
  { method: "POST", re: /^\/tasks$/, handle: (_m, _u, body) => {
      const r = tasks.create(body);
      return r.error ? { status: 400, body: { error: "invalid task", fields: r.error } } : { status: 201, body: tasks.project(r) };
    } },
  { method: "GET", re: /^\/tasks\/([\w-]+)$/, handle: (m) => {
      const t = store.get(m[1]);
      return t ? { status: 200, body: tasks.project(t) } : { status: 404, body: { error: "no such task", id: m[1] } };
    } },
  { method: "PATCH", re: /^\/tasks\/([\w-]+)$/, handle: (m, _u, body) => {
      const r = tasks.update(m[1], body);
      if (r === null) return { status: 404, body: { error: "no such task", id: m[1] } };
      return r.error ? { status: 400, body: { error: "invalid task", fields: r.error } } : { status: 200, body: tasks.project(r) };
    } },
  { method: "DELETE", re: /^\/tasks\/([\w-]+)$/, handle: (m) =>
      (store.drop(m[1]) ? { status: 204, body: null } : { status: 404, body: { error: "no such task", id: m[1] } }) },
  // The lab's own result, served so a dashboard can read it without a shell.
  { method: "GET", re: /^\/lab$/, handle: () => {
      const f = path.join(HERE, "..", "var", "lab.json");
      try { return { status: 200, body: JSON.parse(fs.readFileSync(f, "utf8")) }; }
      catch { return { status: 404, body: { error: "no lab run stored", how: "npm run lab" } }; }
    } },
];

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}

export function handler(req, res) {
  const send = (status, body) => {
    const text = body === null ? "" : JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text), "cache-control": "no-store" });
    res.end(text);
  };
  const url = new URL(req.url, "http://localhost");
  const hit = ROUTES.find((r) => r.method === req.method && r.re.test(url.pathname));
  if (!hit) {
    const allowed = ROUTES.filter((r) => r.re.test(url.pathname)).map((r) => r.method);
    if (allowed.length) return send(405, { error: "method not allowed", path: url.pathname, allowed });
    return send(404, { error: "no such route", path: url.pathname });
  }
  const m = hit.re.exec(url.pathname);
  const run = (body) => {
    if (body === null) return send(400, { error: "body is not JSON" });
    try { const r = hit.handle(m, url, body); send(r.status, r.body); }
    catch (e) { send(500, { error: "unhandled", why: String(e.message || e) }); }
  };
  if (req.method === "POST" || req.method === "PATCH") readBody(req).then(run);
  else run({});
}

export function serve(port = Number(process.env.PORT || 8422)) {
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, port })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  serve().then(({ port }) => console.log(`tokenlab on http://127.0.0.1:${port}`));
}
