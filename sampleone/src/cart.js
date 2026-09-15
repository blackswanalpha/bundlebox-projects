// cart.js — one cart per customer, priced on every read.
//
// The unit price is copied onto the line when the line is created, and the cart
// is re-priced against the catalogue on every read. Those two facts together
// are what lets `GET /cart` tell a customer that something they added last week
// has changed price, instead of silently charging the old one at checkout.
import { read, update } from "./store.js";
import { byId } from "./catalog.js";
import { totals } from "./money.js";

export const TAX_BP = Number(process.env.SAMPLEONE_TAX_BP || 825);
export const SHIPPING_CENTS = Number(process.env.SAMPLEONE_SHIPPING_CENTS || 599);
export const FREE_SHIPPING_OVER_CENTS = Number(process.env.SAMPLEONE_FREE_SHIPPING_CENTS || 7500);
export const MAX_QTY = 99;

const blank = (customerId) => ({ customer_id: customerId, lines: [], coupon: null, updated: new Date().toISOString() });

export const of = (customerId) => read().carts[customerId] || blank(customerId);

/** The cart as the customer should see it: every line re-priced, every change
 *  since it was added named, and the receipt arithmetic done once. */
export function view(customerId) {
  const cart = of(customerId);
  const lines = [];
  const changed = [];
  for (const l of cart.lines) {
    const p = byId(l.product_id);
    if (!p) { changed.push({ product_id: l.product_id, what: "gone", was: l.unit_cents, now: null }); continue; }
    if (p.price_cents !== l.unit_cents) changed.push({ product_id: l.product_id, what: "price", was: l.unit_cents, now: p.price_cents });
    lines.push({
      id: l.id, product_id: p.id, sku: p.sku, name: p.name,
      unit_cents: p.price_cents, qty: l.qty,
      line_cents: p.price_cents * l.qty,
      in_stock: p.stock >= l.qty, stock: p.stock,
    });
  }
  const sub = lines.reduce((a, l) => a + l.line_cents, 0);
  const shipping = lines.length === 0 || sub >= FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS;
  return {
    customer_id: customerId,
    lines,
    changed,
    coupon: cart.coupon,
    ...totals({ lines: lines.map((l) => ({ unit_cents: l.unit_cents, qty: l.qty })), taxBp: TAX_BP, shippingCents: shipping, discountBp: cart.coupon?.basis_points || 0 }),
    currency: "USD",
  };
}

export function addLine(customerId, productId, qty) {
  // Not truncated. `Math.trunc(1.5)` is the service deciding what the customer
  // meant, and a customer who asked for 1.5 and was charged for 1 has no way to
  // tell that happened.
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 1) return { ok: false, status: 422, why: "qty must be a whole number of units, at least 1" };
  if (n > MAX_QTY) return { ok: false, status: 422, why: `qty may not exceed ${MAX_QTY}` };
  const p = byId(productId);
  if (!p) return { ok: false, status: 404, why: "no such product" };
  return update((db) => {
    const cart = db.carts[customerId] || (db.carts[customerId] = blank(customerId));
    const existing = cart.lines.find((l) => l.product_id === p.id);
    // Adding the same product twice is one line with a larger quantity, not two
    // lines: two lines of the same sku is a receipt nobody can read and a
    // stock reservation that double-counts.
    if (existing) {
      const merged = existing.qty + n;
      if (merged > MAX_QTY) return { ok: false, status: 422, why: `that would make ${merged}; the limit is ${MAX_QTY} per product` };
      existing.qty = merged;
    } else {
      cart.lines.push({ id: `L${cart.lines.length + 1}-${p.id}`, product_id: p.id, unit_cents: p.price_cents, qty: n });
    }
    cart.updated = new Date().toISOString();
    return { ok: true, status: 200 };
  });
}

export function setQty(customerId, lineId, qty) {
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 0) return { ok: false, status: 422, why: "qty must be a whole number of units, zero or more" };
  if (n > MAX_QTY) return { ok: false, status: 422, why: `qty may not exceed ${MAX_QTY}` };
  return update((db) => {
    const cart = db.carts[customerId];
    const line = cart?.lines.find((l) => l.id === lineId);
    if (!line) return { ok: false, status: 404, why: "no such line" };
    if (n === 0) cart.lines = cart.lines.filter((l) => l.id !== lineId);
    else line.qty = n;
    cart.updated = new Date().toISOString();
    return { ok: true, status: 200 };
  });
}

export function removeLine(customerId, lineId) {
  return update((db) => {
    const cart = db.carts[customerId];
    if (!cart || !cart.lines.some((l) => l.id === lineId)) return { ok: false, status: 404, why: "no such line" };
    cart.lines = cart.lines.filter((l) => l.id !== lineId);
    cart.updated = new Date().toISOString();
    return { ok: true, status: 200 };
  });
}

export function clear(customerId) {
  return update((db) => { delete db.carts[customerId]; return { ok: true }; });
}

export function applyCoupon(customerId, code) {
  const c = String(code || "").trim().toUpperCase();
  const known = { SAVE10: 1000, SAVE25: 2500, HALF: 5000 };
  if (!(c in known)) return { ok: false, status: 422, why: "no such coupon" };
  return update((db) => {
    const cart = db.carts[customerId] || (db.carts[customerId] = blank(customerId));
    cart.coupon = { code: c, basis_points: known[c] };
    return { ok: true, status: 200, coupon: cart.coupon };
  });
}
