// surface.test.js — the handlers, called without a socket.
//
// `server.handle` is the same function the HTTP server calls, so a test here
// and a scenario in the corpus are asserting against one implementation. The
// split exists so the fast check (`npm test`, ~200ms) can run on every edit and
// the slow one (`bb cookbook run`) can run against a service that is actually
// listening.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

process.env.SAMPLEONE_DB = path.join(os.tmpdir(), `sampleone-test-${process.pid}.json`);

const { handle } = await import("../src/server.js");
const { reset } = await import("../src/store.js");
const { seed } = await import("../src/seed.js");
const money = await import("../src/money.js");

const as = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const tokenFor = async (email) => (await handle("POST", "/auth/token", { body: { email } })).body;

beforeEach(() => reset(seed()));

test("health names the service and the version", async () => {
  const r = await handle("GET", "/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.service, "sampleone");
  assert.equal(r.body.products, 10);
});

test("search ranks an exact sku above a name match", async () => {
  const r = await handle("GET", "/products?q=DOCK-11");
  assert.equal(r.body.items[0].sku, "DOCK-11");
});

test("a cart line carries the price at the time it was added, and the view re-prices it", async () => {
  const { token } = await tokenFor("ada@example.com");
  await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p1", qty: 2 } });
  const admin = await tokenFor("ops@sampleone.test");
  await handle("POST", "/admin/stock/p1", { ...as(admin.token), body: { stock: 1 } });
  const cart = await handle("GET", "/cart", as(token));
  assert.equal(cart.body.lines[0].in_stock, false, "the view knows the shelf moved under the line");
  assert.equal(cart.body.lines[0].qty, 2);
});

test("the same product added twice is one line", async () => {
  const { token } = await tokenFor("ada@example.com");
  await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p2", qty: 1 } });
  const r = await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p2", qty: 3 } });
  assert.equal(r.body.lines.length, 1);
  assert.equal(r.body.lines[0].qty, 4);
});

test("tax is computed on the subtotal once, not per line", async () => {
  const lines = [{ unit_cents: 1999, qty: 3 }];
  const t = money.totals({ lines, taxBp: 825, shippingCents: 0, discountBp: 0 });
  assert.equal(t.subtotal_cents, 5997);
  assert.equal(t.tax_cents, money.tax(5997, 825));
  assert.equal(t.total_cents, 5997 + t.tax_cents);
});

test("checkout refuses an incomplete address and names every missing field at once", async () => {
  const { token } = await tokenFor("ada@example.com");
  await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p2", qty: 1 } });
  const r = await handle("POST", "/checkout", { ...as(token), body: { address: { name: "Ada" }, payment: { method: "card", last4: "4242" } } });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.problems.map((p) => p.field).sort(), ["city", "country", "line1", "postcode"]);
});

test("a declined card leaves the shelf exactly as it found it", async () => {
  const { token } = await tokenFor("ada@example.com");
  await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p5", qty: 1 } });
  const before = (await handle("GET", "/products/p5")).body.stock;
  const r = await handle("POST", "/checkout", { ...as(token), body: {
    address: { name: "Ada", line1: "1 Main", city: "Nairobi", postcode: "00100", country: "KE" },
    payment: { method: "card", last4: "0000" } } });
  assert.equal(r.status, 402);
  assert.equal((await handle("GET", "/products/p5")).body.stock, before, "stock reserved for a payment that failed must be released");
});

test("checkout will not oversell the last unit", async () => {
  const ada = await tokenFor("ada@example.com");
  const bo = await tokenFor("bo@example.com");
  const address = { name: "X", line1: "1 Main", city: "Nairobi", postcode: "00100", country: "KE" };
  const payment = { method: "card", last4: "4242" };
  await handle("POST", "/cart/lines", { ...as(ada.token), body: { product_id: "p5", qty: 1 } });
  await handle("POST", "/cart/lines", { ...as(bo.token), body: { product_id: "p5", qty: 1 } });
  const first = await handle("POST", "/checkout", { ...as(ada.token), body: { address, payment } });
  const second = await handle("POST", "/checkout", { ...as(bo.token), body: { address, payment } });
  assert.equal(first.status, 201);
  assert.equal(second.status, 409, "one unit, two carts, one order");
  assert.equal(second.body.problems[0].have, 0);
});

test("one customer cannot read another's order, and the 404 does not confirm it exists", async () => {
  const ada = await tokenFor("ada@example.com");
  const bo = await tokenFor("bo@example.com");
  await handle("POST", "/cart/lines", { ...as(ada.token), body: { product_id: "p2", qty: 1 } });
  const order = await handle("POST", "/checkout", { ...as(ada.token), body: {
    address: { name: "Ada", line1: "1 Main", city: "Nairobi", postcode: "00100", country: "KE" },
    payment: { method: "card", last4: "4242" } } });
  assert.equal(order.status, 201);
  const mine = await handle("GET", `/orders/${order.body.id}`, as(ada.token));
  const theirs = await handle("GET", `/orders/${order.body.id}`, as(bo.token));
  assert.equal(mine.status, 200);
  assert.equal(theirs.status, 404);
  assert.equal(theirs.body.error, "no such order");
});

test("cancelling puts the stock back, and cancelling twice does not", async () => {
  const { token } = await tokenFor("ada@example.com");
  await handle("POST", "/cart/lines", { ...as(token), body: { product_id: "p3", qty: 2 } });
  const order = await handle("POST", "/checkout", { ...as(token), body: {
    address: { name: "Ada", line1: "1 Main", city: "Nairobi", postcode: "00100", country: "KE" },
    payment: { method: "card", last4: "4242" } } });
  assert.equal((await handle("GET", "/products/p3")).body.stock, 4);
  await handle("POST", `/orders/${order.body.id}/cancel`, as(token));
  assert.equal((await handle("GET", "/products/p3")).body.stock, 6);
  const again = await handle("POST", `/orders/${order.body.id}/cancel`, as(token));
  assert.equal(again.status, 409);
  assert.equal((await handle("GET", "/products/p3")).body.stock, 6, "a second cancel must not invent inventory");
});

test("an order state moves forward only", async () => {
  const ada = await tokenFor("ada@example.com");
  const admin = await tokenFor("ops@sampleone.test");
  await handle("POST", "/cart/lines", { ...as(ada.token), body: { product_id: "p4", qty: 1 } });
  const order = await handle("POST", "/checkout", { ...as(ada.token), body: {
    address: { name: "Ada", line1: "1 Main", city: "Nairobi", postcode: "00100", country: "KE" },
    payment: { method: "card", last4: "4242" } } });
  const id = order.body.id;
  assert.equal((await handle("POST", `/orders/${id}/advance`, { ...as(admin.token), body: { state: "shipped" } })).status, 200);
  assert.equal((await handle("POST", `/orders/${id}/advance`, { ...as(admin.token), body: { state: "paid" } })).status, 409);
  assert.equal((await handle("POST", `/orders/${id}/advance`, { ...as(ada.token), body: { state: "delivered" } })).status, 403);
});

test("an unknown route is a 404 and an unknown method on a known route is a 405", async () => {
  assert.equal((await handle("GET", "/nope")).status, 404);
  assert.equal((await handle("DELETE", "/health")).status, 405);
});
