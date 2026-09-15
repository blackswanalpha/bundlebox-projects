// money.js — every amount in this service is an integer number of cents.
//
// A cart with three lines at 19.99 and 8.25% tax is the shortest path to a
// float that ends in .0000000004, and an order total that disagrees with the
// sum of its lines by a cent is a support ticket rather than a crash. So there
// is no float anywhere: prices are cents, rates are basis points, and the only
// rounding happens once, here, with the rule stated.
export const CENTS = 100;

export const fromMajor = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * CENTS);
};

export const toMajor = (cents) => (Number(cents) || 0) / CENTS;

/** "12.34" for a table, never for arithmetic. */
export const format = (cents, currency = "USD") =>
  `${currency} ${(Math.round(Number(cents) || 0) / CENTS).toFixed(2)}`;

/** Tax in BASIS POINTS (825 = 8.25%), rounded half-up once at the end.
 *
 *  Rounding per line and rounding on the subtotal give different answers, and
 *  the difference is visible to a customer who adds up the receipt. The rule
 *  here is: tax is computed on the SUBTOTAL, once. Anything else has to be a
 *  deliberate change with a test that names the jurisdiction requiring it. */
export function tax(subtotalCents, basisPoints) {
  const sub = Math.round(Number(subtotalCents) || 0);
  const bp = Math.round(Number(basisPoints) || 0);
  return Math.floor((sub * bp + 5000) / 10000);
}

/** A line's own total. Quantity is an integer because half a unit is not a
 *  thing this catalogue sells, and a fractional qty would reintroduce the
 *  float this module exists to remove. */
export function lineTotal(unitCents, qty) {
  const u = Math.round(Number(unitCents) || 0);
  const q = Math.trunc(Number(qty) || 0);
  return u * q;
}

/** A percentage-off coupon, in basis points, floored so a discount can never
 *  round UP and make the order cost more than the arithmetic says. */
export function discount(subtotalCents, basisPoints) {
  const sub = Math.round(Number(subtotalCents) || 0);
  const bp = Math.min(10000, Math.max(0, Math.round(Number(basisPoints) || 0)));
  return Math.floor((sub * bp) / 10000);
}

/** The whole receipt, in the order the customer reads it. Returned as one
 *  object so no caller has to remember that shipping is taxed here and the
 *  discount is applied before tax. */
export function totals({ lines = [], taxBp = 0, shippingCents = 0, discountBp = 0 }) {
  const subtotal = lines.reduce((a, l) => a + lineTotal(l.unit_cents, l.qty), 0);
  const discountCents = discount(subtotal, discountBp);
  const taxable = subtotal - discountCents + shippingCents;
  const taxCents = tax(taxable, taxBp);
  return {
    subtotal_cents: subtotal,
    discount_cents: discountCents,
    shipping_cents: Math.round(Number(shippingCents) || 0),
    tax_cents: taxCents,
    total_cents: taxable + taxCents,
  };
}
