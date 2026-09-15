// store.js — the whole database: one JSON file, written atomically.
//
// Relay exists to be MEASURED, not to scale. A real store would put a container
// between `bb runbook up` and the first scenario; one file keeps the service
// startable in tens of milliseconds, which is what makes a corpus that advances
// a clock and re-reads the board cheap to run over and over.
//
// Atomic write via rename, because a half-written incident read back by the
// next request is the kind of failure that reads as a product defect for an
// hour before anybody looks at the file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.env.SAMPLETWO_DB || path.join(ROOT, "var", "db.json");

export const EMPTY = {
  services: [], responders: [], rotations: [], policies: [],
  alerts: [], incidents: [], notifications: [],
  clock_ms: 0, seq: { incident: 4000, alert: 0, note: 0 },
};

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
