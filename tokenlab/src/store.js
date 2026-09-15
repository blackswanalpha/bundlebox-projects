// store.js — one JSON file, written whole. No database, because the point of
// this service is to be a stable target for `bb cookbook` and `bb simulate`,
// and a target with a second process in it is a target that can fail for a
// reason that has nothing to do with what is being measured.
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.TOKENLAB_STORE || path.join(process.cwd(), "var", "tasks.json");

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { seq: 0, tasks: {} }; }
}

function write(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  // Write to a temp file and rename: a load test at 32 concurrent callers will
  // read this file mid-write, and a torn read is a 500 nobody can reproduce.
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

let db = read();

export function reset() { db = { seq: 0, tasks: {} }; write(db); }
export function all() { return Object.values(db.tasks); }
export function get(id) { return db.tasks[id] || null; }
export function next() { db.seq += 1; return `tk-${db.seq}`; }
export function put(task) { db.tasks[task.id] = task; write(db); return task; }
export function drop(id) { if (!db.tasks[id]) return false; delete db.tasks[id]; write(db); return true; }
