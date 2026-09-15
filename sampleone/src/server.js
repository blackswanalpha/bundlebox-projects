// server.js — the HTTP surface, and the only file that knows about HTTP.
//
// Every handler returns `{status, body}` and this file turns that into a
// response. That split is what lets `test/` call the handlers directly and the
// scenario corpus call them over the wire, and get the same answers from both.
//
// Logging is one line per request in a fixed shape, because `bb runbook logs`
// reads these by signature: a request line whose variable parts are a path, a
// status and a duration collapses to one row per route no matter how many
// times it is called.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as catalog from "./catalog.js";
import * as cart from "./cart.js";
import * as orders from "./orders.js";
import { bearer, issue, owns } from "./auth.js";
import { read, reset } from "./store.js";
import { seed } from "./seed.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = "1.0.0";
const STARTED = Date.now();

const json = (status, body) => ({ status, body });
const problem = (status, why, extra = {}) => json(status, { error: why, ...extra });

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

/** The route table. One row per route so the surface is readable in one place,
 *  and so `bb genesis` can be checked against it: a route here that no scenario
 *  touches is a gap the board reports rather than a gap nobody notices. */
export const ROUTES = [
  ["GET", /^\/health$/, health],
  ["GET", /^\/products$/, listProducts],
  ["GET", /^\/products\/([\w-]+)$/, getProduct],
  ["POST", /^\/auth\/token$/, token],
  ["GET", /^\/cart$/, getCart],
  ["POST", /^\/cart\/lines$/, addLine],
  ["PATCH", /^\/cart\/lines\/([\w-]+)$/, patchLine],
  ["DELETE", /^\/cart\/lines\/([\w-]+)$/, deleteLine],
  ["POST", /^\/cart\/coupon$/, coupon],
  ["POST", /^\/checkout$/, checkout],
  ["GET", /^\/orders$/, listOrders],
  ["GET", /^\/orders\/([\w-]+)$/, getOrder],
  ["POST", /^\/orders\/([\w-]+)\/cancel$/, cancelOrder],
  ["POST", /^\/orders\/([\w-]+)\/advance$/, advanceOrder],
  ["GET", /^\/admin\/stock$/, adminStock],
  ["POST", /^\/admin\/stock\/([\w-]+)$/, adminSetStock],
  ["POST", /^\/admin\/reset$/, adminReset],
];

function health() {
  const db = read();
  return json(200, {
    ok: true, service: "sampleone", version: VERSION,
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
    products: db.products.length, orders: db.orders.length,
  });
}

function listProducts(req, m, body, url) {
  const q = url.searchParams;
  return json(200, catalog.search({ q: q.get("q") || "", tag: q.get("tag") || "", page: q.get("page"), size: q.get("size") }));
}

function getProduct(req, m) {
  const p = catalog.byId(m[1]);
  return p ? json(200, p) : problem(404, "no such product");
}

function token(req, m, body) {
  const email = String(body?.email || "").trim().toLowerCase();
  // A syntactic check only. Deliverability is not something this service can
  // know, and a regex that claims to decide it rejects real addresses.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return problem(422, "email must look like an address");
  const db = read();
  let c = db.customers.find((x) => x.email === email);
  if (!c) {
    c = { id: `C${db.customers.length + 1}`, email, role: email.endsWith("@sampleone.test") ? "admin" : "customer", created: new Date().toISOString() };
    db.customers.push(c);
  }
  return json(200, { token: issue(c.id, c.role), customer_id: c.id, role: c.role });
}

const needActor = (req) => bearer(req);

/** 401 and 403 answer different questions and must not be merged.
 *  401 is "I do not know who you are"; 403 is "I know, and that is not enough".
 *  Returning 403 for an unreadable token tells the holder of a forged one that
 *  it parsed, which is the only feedback a forger needs. */
function needAdmin(req) {
  const a = bearer(req);
  if (!a) return { actor: null, deny: problem(401, "a bearer token is required") };
  if (a.role !== "admin") return { actor: a, deny: problem(403, "admin only") };
  return { actor: a, deny: null };
}

function getCart(req) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  return json(200, cart.view(a.customer_id));
}

function addLine(req, m, body) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const r = cart.addLine(a.customer_id, body?.product_id, body?.qty);
  return r.ok ? json(200, cart.view(a.customer_id)) : problem(r.status, r.why);
}

function patchLine(req, m, body) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const r = cart.setQty(a.customer_id, m[1], body?.qty);
  return r.ok ? json(200, cart.view(a.customer_id)) : problem(r.status, r.why);
}

function deleteLine(req, m) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const r = cart.removeLine(a.customer_id, m[1]);
  return r.ok ? json(200, cart.view(a.customer_id)) : problem(r.status, r.why);
}

function coupon(req, m, body) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const r = cart.applyCoupon(a.customer_id, body?.code);
  return r.ok ? json(200, cart.view(a.customer_id)) : problem(r.status, r.why);
}

function checkout(req, m, body) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const r = orders.checkout(a.customer_id, body || {});
  return r.ok ? json(201, r.order) : problem(r.status, r.why, { problems: r.problems });
}

function listOrders(req, m, body, url) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  return json(200, orders.forCustomer(a, { page: url.searchParams.get("page"), size: url.searchParams.get("size") }));
}

function getOrder(req, m) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const o = orders.byId(m[1]);
  // 404 rather than 403 for somebody else's order: a 403 confirms the id
  // exists, which is the whole of an enumeration attack.
  if (!o || !owns(a, o)) return problem(404, "no such order");
  return json(200, o);
}

function cancelOrder(req, m) {
  const a = needActor(req);
  if (!a) return problem(401, "a bearer token is required");
  const o = orders.byId(m[1]);
  if (!o || !owns(a, o)) return problem(404, "no such order");
  const r = orders.cancel(m[1]);
  if (!r.ok) return problem(r.status, r.why);
  catalog.release(r.restock);
  return json(200, r.order);
}

function advanceOrder(req, m, body) {
  const { deny } = needAdmin(req);
  if (deny) return deny;
  const r = orders.advance(m[1], body?.state);
  return r.ok ? json(200, r.order) : problem(r.status, r.why);
}

function adminStock(req) {
  const { deny } = needAdmin(req);
  if (deny) return deny;
  return json(200, { items: catalog.all().map((p) => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock })) });
}

function adminSetStock(req, m, body) {
  const { deny } = needAdmin(req);
  if (deny) return deny;
  const r = catalog.setStock(m[1], body?.stock);
  return r.ok ? json(200, r.product) : problem(r.why === "no such product" ? 404 : 422, r.why);
}

function adminReset(req) {
  const { deny } = needAdmin(req);
  if (deny) return deny;
  reset(seed());
  return json(200, { ok: true, products: read().products.length });
}

/** One request, as a value. Exported so the tests can call the surface without
 *  a socket and get the same answer the corpus gets over one. */
export async function handle(method, target, { headers = {}, body = null } = {}) {
  const url = new URL(target, "http://127.0.0.1");
  // Every row whose PATH matches, then the one whose method does. Returning 405
  // from the first path match would mean `DELETE /cart/lines/:id` was answered
  // by the PATCH row sitting above it — a 405 for a route that exists.
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

export function create() {
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
    if (req.method === "GET" && !url.pathname.startsWith("/api") && serveStatic(url.pathname, res)) {
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
  const port = Number(process.env.PORT || process.argv.find((a) => a.startsWith("--port="))?.slice(7) || 8500);
  if (!read().products.length) reset(seed());
  create().listen(port, "127.0.0.1", () => process.stdout.write(`${new Date().toISOString()} INFO sampleone ${VERSION} listening on 127.0.0.1:${port}\n`));
}
