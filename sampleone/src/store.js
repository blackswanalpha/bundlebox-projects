// store.js — the whole database: one JSON file, written atomically.
//
// sampleOne exists to be MEASURED, not to scale, and a real database would put
// a container between `bb runbook up` and the first scenario. One file keeps
// the service startable in 40ms, which is what makes the readiness gate and the
// scenario corpus cheap to run over and over.
//
// Atomic write via rename, because a half-written catalogue read back by the
// next request is the kind of failure that reads as a product defect for an
// hour before somebody looks at the file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FILE = process.env.SAMPLEONE_DB || path.join(ROOT, "var", "db.json");

export const EMPTY = { products: [], customers: [], carts: {}, orders: [], seq: { order: 1000 } };

let cache = null;

export function read() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { cache = structuredClone(EMPTY); }
  for (const k of Object.keys(EMPTY)) if (cache[k] === undefined) cache[k] = structuredClone(EMPTY[k]);
  return cache;
}

export function write(next) {
  cache = next;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, FILE);
  return next;
}

/** Read, change, write. Returned value is whatever the mutator returns, so a
 *  caller gets the row it created without a second read. */
export function update(fn) {
  const db = read();
  const out = fn(db);
  write(db);
  return out;
}

export function reset(seed = null) {
  cache = null;
  write(seed ? structuredClone(seed) : structuredClone(EMPTY));
  return read();
}

export const nextId = (db, kind) => {
  db.seq[kind] = (db.seq[kind] || 0) + 1;
  return db.seq[kind];
};
