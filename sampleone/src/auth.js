// auth.js — who is asking, and what they are allowed to see.
//
// A token here is an HMAC of the customer id and a role, signed with a secret
// from the environment. It is deliberately not a JWT: this service exists to be
// measured and a JWT library would be the only dependency in the tree.
//
// The rule this file exists to hold: **every read of a customer-scoped row goes
// through `owns`.** A tenancy leak is invisible in a test that runs as one
// user, which is why the corpus has two actors and asserts that the second
// cannot see the first's order.
import crypto from "node:crypto";

const SECRET = process.env.SAMPLEONE_SECRET || "dev-secret-not-for-production";
export const ROLES = new Set(["customer", "admin"]);

const sign = (payload) => crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");

export function issue(customerId, role = "customer") {
  if (!ROLES.has(role)) throw new Error(`unknown role ${role}`);
  const payload = `${customerId}.${role}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** The customer behind a token, or null. Null is the only failure value: a
 *  caller that cannot tell "no token" from "bad token" would log a broken
 *  client as an attack. The 401 body says which. */
export function verify(token) {
  const t = String(token || "");
  const dot = t.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = Buffer.from(t.slice(0, dot), "base64url").toString("utf8");
  const mac = t.slice(dot + 1);
  const want = sign(payload);
  // Constant-time compare: a token check that returns early on the first wrong
  // character is a token check that can be guessed one character at a time.
  if (mac.length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  const [customerId, role] = payload.split(".");
  if (!customerId || !ROLES.has(role)) return null;
  return { customer_id: customerId, role };
}

export function bearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? verify(m[1]) : null;
}

/** The one check every customer-scoped handler makes. An admin sees everything;
 *  a customer sees their own rows and nothing else. */
export const owns = (actor, row) =>
  Boolean(actor) && (actor.role === "admin" || String(row?.customer_id) === String(actor.customer_id));
