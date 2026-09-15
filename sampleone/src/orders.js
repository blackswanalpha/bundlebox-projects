// orders.js — checkout, and the order lifecycle after it.
//
// Checkout is the only place in this service where three things have to happen
// together: stock leaves the shelf, money is authorised, and an order row is
// written. The order they happen in is the whole design:
//
//   1. validate the address and the payment shape   — cheap, no side effect
//   2. reserve stock, all or nothing                — the only contended step
//   3. authorise payment                            — may fail
//   4. write the order, clear the cart              — commits
//
// Payment is authorised AFTER stock, because a customer charged for an item
// that turned out to be sold out is a refund and a complaint, while stock held
// for a payment that then fails is released in step 3's failure path and costs
// nobody anything.
import { read, update, nextId } from "./store.js";
import * as cart from "./cart.js";
import * as catalog from "./catalog.js";
import { owns } from "./auth.js";

export const STATES = ["placed", "paid", "shipped", "delivered", "cancelled"];
export const CANCELLABLE = new Set(["placed", "paid"]);

const REQUIRED_ADDRESS = ["name", "line1", "city", "postcode", "country"];

/** What is wrong with the address, as a list. One field at a time is a form
 *  the customer submits five times. */
export function addressProblems(address) {
  const a = address || {};
  const missing = REQUIRED_ADDRESS.filter((f) => !String(a[f] || "").trim());
  const problems = missing.map((f) => ({ field: f, why: "required" }));
  if (a.country && String(a.country).trim().length !== 2) problems.push({ field: "country", why: "must be a two-letter ISO code" });
  if (a.postcode && String(a.postcode).trim().length > 12) problems.push({ field: "postcode", why: "at most 12 characters" });
  return problems;
}

export function paymentProblems(payment) {
  const p = payment || {};
  const problems = [];
  if (!p.method) problems.push({ field: "method", why: "required" });
  else if (!["card", "invoice"].includes(p.method)) problems.push({ field: "method", why: "must be card or invoice" });
  if (p.method === "card" && !/^\d{4}$/.test(String(p.last4 || ""))) problems.push({ field: "last4", why: "four digits" });
  return problems;
}

/** The payment gateway, standing in for one. Declines a card ending 0000 so
 *  the corpus has a decline path that does not depend on a real processor. */
function authorise(payment, amountCents) {
  if (payment.method === "invoice") return { ok: true, reference: `INV-${Date.now()}` };
  if (String(payment.last4) === "0000") return { ok: false, why: "card declined" };
  if (amountCents <= 0) return { ok: false, why: "nothing to charge" };
  return { ok: true, reference: `AUTH-${Date.now()}` };
}

export function checkout(customerId, { address, payment } = {}) {
  const problems = [...addressProblems(address).map((p) => ({ ...p, in: "address" })),
    ...paymentProblems(payment).map((p) => ({ ...p, in: "payment" }))];
  if (problems.length) return { ok: false, status: 422, why: "the order was not accepted", problems };

  const view = cart.view(customerId);
  if (!view.lines.length) return { ok: false, status: 422, why: "the cart is empty", problems: [] };

  const want = view.lines.map((l) => ({ product_id: l.product_id, qty: l.qty }));
  const held = catalog.reserve(want);
  if (!held.ok) return { ok: false, status: 409, why: "not everything is still available", problems: held.short };

  const auth = authorise(payment, view.total_cents);
  if (!auth.ok) {
    // Step 3's failure path. Without this line the shelf loses the stock and
    // nothing ever puts it back, which is the failure this ordering exists to
    // make recoverable.
    catalog.release(want);
    return { ok: false, status: 402, why: auth.why, problems: [] };
  }

  const order = update((db) => {
    const id = `ORD-${nextId(db, "order")}`;
    const row = {
      id, customer_id: customerId, state: "paid",
      lines: view.lines.map((l) => ({ product_id: l.product_id, sku: l.sku, name: l.name, unit_cents: l.unit_cents, qty: l.qty, line_cents: l.line_cents })),
      subtotal_cents: view.subtotal_cents, discount_cents: view.discount_cents,
      shipping_cents: view.shipping_cents, tax_cents: view.tax_cents, total_cents: view.total_cents,
      currency: view.currency, coupon: view.coupon, address, payment: { method: payment.method, last4: payment.last4 || null, reference: auth.reference },
      placed: new Date().toISOString(), history: [{ state: "placed", at: new Date().toISOString() }, { state: "paid", at: new Date().toISOString() }],
    };
    db.orders.push(row);
    return row;
  });
  cart.clear(customerId);
  return { ok: true, status: 201, order };
}

export const byId = (id) => read().orders.find((o) => o.id === String(id)) || null;

/** A customer's orders, newest first. Never a full scan handed to a caller:
 *  the filter is here so no handler can forget it. */
export function forCustomer(actor, { page = 1, size = 20 } = {}) {
  const rows = read().orders.filter((o) => owns(actor, o)).sort((a, b) => (a.placed < b.placed ? 1 : -1));
  const n = Math.max(1, Math.trunc(Number(size) || 20));
  const pg = Math.max(1, Math.trunc(Number(page) || 1));
  return { total: rows.length, page: pg, size: n, items: rows.slice((pg - 1) * n, pg * n) };
}

export function cancel(id) {
  return update((db) => {
    const o = db.orders.find((x) => x.id === String(id));
    if (!o) return { ok: false, status: 404, why: "no such order" };
    if (o.state === "cancelled") return { ok: false, status: 409, why: "already cancelled" };
    if (!CANCELLABLE.has(o.state)) return { ok: false, status: 409, why: `an order that is ${o.state} cannot be cancelled` };
    o.state = "cancelled";
    o.history.push({ state: "cancelled", at: new Date().toISOString() });
    return { ok: true, status: 200, order: o, restock: o.lines.map((l) => ({ product_id: l.product_id, qty: l.qty })) };
  });
}

export function advance(id, to) {
  if (!STATES.includes(to)) return { ok: false, status: 422, why: `state must be one of ${STATES.join(", ")}` };
  return update((db) => {
    const o = db.orders.find((x) => x.id === String(id));
    if (!o) return { ok: false, status: 404, why: "no such order" };
    const order = STATES.indexOf(o.state);
    const next = STATES.indexOf(to);
    // Forward only, and never out of a terminal state. An order that can go
    // back to `placed` is an order whose history means nothing.
    if (o.state === "cancelled" || o.state === "delivered") return { ok: false, status: 409, why: `${o.state} is terminal` };
    if (next <= order) return { ok: false, status: 409, why: `${o.state} does not move to ${to}` };
    o.state = to;
    o.history.push({ state: to, at: new Date().toISOString() });
    return { ok: true, status: 200, order: o };
  });
}
