// catalog.js — products, search and stock.
//
// Stock is the field every other module is wrong about if this one is. A cart
// may hold more than is on the shelf (people browse), but checkout may not:
// `reserve` is the single place quantity leaves the shelf, and it either takes
// the whole order or takes nothing.
import { read, update } from "./store.js";

export const PAGE = 20;

export const all = () => read().products;
export const byId = (id) => read().products.find((p) => p.id === String(id)) || null;

/** Search across name, sku and tags. Ranked so an exact sku beats a tag match,
 *  because a customer typing a sku knows exactly what they want. */
export function search({ q = "", tag = "", page = 1, size = PAGE } = {}) {
  const term = String(q || "").trim().toLowerCase();
  const rows = all().filter((p) => {
    if (tag && !(p.tags || []).includes(tag)) return false;
    if (!term) return true;
    return p.sku.toLowerCase() === term
      || p.name.toLowerCase().includes(term)
      || (p.tags || []).some((t) => t.includes(term));
  });
  const rank = (p) => (p.sku.toLowerCase() === term ? 0 : p.name.toLowerCase().startsWith(term) ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const n = Math.max(1, Math.trunc(Number(size) || PAGE));
  const pg = Math.max(1, Math.trunc(Number(page) || 1));
  return { total: rows.length, page: pg, size: n, items: rows.slice((pg - 1) * n, pg * n) };
}

export const inStock = (p, qty) => Boolean(p) && p.stock >= Math.trunc(Number(qty) || 0);

/** Take `lines` off the shelf, or take nothing.
 *
 *  All-or-nothing is not a nicety: a partial reserve leaves the customer with
 *  an order they did not agree to and the shelf in a state no report explains.
 *  The check runs over every line BEFORE the first decrement. */
export function reserve(lines) {
  return update((db) => {
    const short = [];
    for (const l of lines) {
      const p = db.products.find((x) => x.id === l.product_id);
      if (!p) { short.push({ product_id: l.product_id, want: l.qty, have: 0, why: "no such product" }); continue; }
      if (p.stock < l.qty) short.push({ product_id: l.product_id, want: l.qty, have: p.stock, why: "not enough stock" });
    }
    if (short.length) return { ok: false, short };
    for (const l of lines) {
      const p = db.products.find((x) => x.id === l.product_id);
      p.stock -= l.qty;
    }
    return { ok: true, short: [] };
  });
}

/** Put stock back. Called when an order is cancelled, and idempotent per
 *  order because a double-cancel that restocks twice invents inventory. */
export function release(lines) {
  return update((db) => {
    for (const l of lines) {
      const p = db.products.find((x) => x.id === l.product_id);
      if (p) p.stock += l.qty;
    }
    return { ok: true };
  });
}

export function setStock(id, qty) {
  const n = Number(qty);
  if (!Number.isInteger(n) || n < 0) return { ok: false, why: "stock must be a whole number of units, zero or more" };
  return update((db) => {
    const p = db.products.find((x) => x.id === String(id));
    if (!p) return { ok: false, why: "no such product" };
    p.stock = n;
    return { ok: true, product: p };
  });
}
