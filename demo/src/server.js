// server.js — the wire. Routes in one table, so the route table and the router
// cannot disagree, and every handler returns {status, body} rather than writing
// to the socket itself.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as items from "./items.js";
import * as store from "./store.js";
import * as log from "./log.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "..", "web");
const started = Date.now();

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

export const ROUTES = [
  { method: "GET", path: /^\/health$/, name: "health",
    handle: () => ({ status: 200, body: { ok: true, uptime_s: Math.round((Date.now() - started) / 1000), items: store.count() } }) },
  { method: "GET", path: /^\/items$/, name: "items.list",
    handle: (req, _m, url) => ({ status: 200, body: { items: items.list({ state: url.searchParams.get("state") }).map(items.project) } }) },
  { method: "POST", path: /^\/items$/, name: "items.create",
    handle: (req, _m, _u, body) => ({ status: 201, body: items.project(items.create(body)) }) },
  { method: "GET", path: /^\/items\/([\w-]+)$/, name: "items.read",
    handle: (req, m) => { const it = items.read(m[1]); return it ? { status: 200, body: items.project(it) } : { status: 404, body: { error: "no such item", id: m[1] } }; } },
  { method: "PATCH", path: /^\/items\/([\w-]+)$/, name: "items.update",
    handle: (req, m, _u, body) => { const it = items.update(m[1], body); return it ? { status: 200, body: items.project(it) } : { status: 404, body: { error: "no such item", id: m[1] } }; } },
  { method: "DELETE", path: /^\/items\/([\w-]+)$/, name: "items.delete",
    handle: (req, m) => (items.drop(m[1]) ? { status: 204, body: null } : { status: 404, body: { error: "no such item", id: m[1] } }) },
];

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch {
    // Worth a line: a client sending malformed JSON is usually a client bug
    // somebody is about to spend an afternoon on.
    log.warn("body is not JSON", { bytes: Buffer.concat(chunks).length });
    const e = new Error("body is not JSON"); e.status = 400; throw e;
  }
}

function serveStatic(url, res) {
  const name = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.join(WEB, path.normalize(name).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(WEB) || !fs.existsSync(file)) return false;
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
  return true;
}

export async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = ROUTES.find((r) => r.method === req.method && r.path.test(url.pathname));
  if (!route) {
    if (req.method === "GET" && serveStatic(url, res)) return;
    log.warn("no such route", { method: req.method, path: url.pathname });
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "no such route", path: url.pathname }));
  }
  const t0 = Date.now();
  try {
    const body = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : null;
    const out = await route.handle(req, route.path.exec(url.pathname), url, body);
    log.info("request", { route: route.name, status: out.status, ms: Date.now() - t0 });
    if (out.body === null) return res.writeHead(out.status).end();
    res.writeHead(out.status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(out.body));
  } catch (e) {
    const status = e.status || 500;
    log.error("request failed", { route: route.name, status, error: e.message });
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: e.message, field: e.field }));
  }
}

export const create = () => http.createServer(handle);

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const port = Number(process.env.PORT || 8420);
  create().listen(port, () => log.info("listening", { port, routes: ROUTES.length }));
}
