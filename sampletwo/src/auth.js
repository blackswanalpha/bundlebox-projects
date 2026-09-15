// auth.js — who is paging, who may answer, and what that buys them.
//
// A token is an HMAC of the responder id and a role, signed with a secret from
// the environment. Deliberately not a JWT: this service exists to be measured
// and a JWT library would be the only dependency in the tree.
//
// The rule this file exists to hold: **being a responder is not authority over
// every incident.** Acknowledging someone else's page while they are still
// looking at it is how two people work the same incident and neither owns it,
// so `mayAnswer` asks who is on call, not merely who is logged in.
import crypto from "node:crypto";

const SECRET = process.env.SAMPLETWO_SECRET || "dev-secret-not-for-production";
const ROLES = new Set(["responder", "commander"]);

const sign = (payload) => crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");

export function issue(responderId, role = "responder") {
  if (!ROLES.has(role)) throw new Error(`unknown role ${role}`);
  const payload = `${responderId}.${role}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** The responder behind a token, or null. Null is the only failure value: a
 *  caller that cannot tell "no token" from "bad token" would log a broken
 *  client as an attack. The 401 body says which. */
function verify(token) {
  const t = String(token || "");
  const dot = t.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = Buffer.from(t.slice(0, dot), "base64url").toString("utf8");
  const mac = t.slice(dot + 1);
  const want = sign(payload);
  // Constant-time compare: a check that returns early on the first wrong
  // character can be guessed one character at a time.
  if (mac.length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  const [responderId, role] = payload.split(".");
  if (!responderId || !ROLES.has(role)) return null;
  return { responder_id: responderId, role };
}

export function bearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? verify(m[1]) : null;
}

/** The one check every incident-scoped action makes. A commander answers
 *  anything. A responder answers what is assigned to them, and what they are
 *  currently on call for — and nothing else. */
export const mayAnswer = (actor, incident, onCallId) =>
  Boolean(actor) && (
    actor.role === "commander" ||
    String(incident?.assignee_id) === String(actor.responder_id) ||
    String(onCallId) === String(actor.responder_id)
  );
