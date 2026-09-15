// store.js — the items, and the only thing that knows how they are persisted.
// A JSON file behind an in-memory map: the file is the durability story and the
// map is the read path, so a read never touches the disk and a write always does.
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.DEMO_STORE || path.join(process.cwd(), "var", "items.json");

let items = new Map();
let seq = 0;
let loaded = false;

export function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const it of raw.items || []) items.set(it.id, it);
    seq = raw.seq || items.size;
  } catch {
    // No file yet is the normal first run, not an error.
    items = new Map();
    seq = 0;
  }
}

function flush() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ seq, items: [...items.values()] }, null, 2));
  fs.renameSync(tmp, FILE);
}

export function reset() { items = new Map(); seq = 0; loaded = true; }
export const all = () => { load(); return [...items.values()]; };
export const get = (id) => { load(); return items.get(id) || null; };
export const count = () => { load(); return items.size; };

export function put(item) {
  load();
  items.set(item.id, item);
  flush();
  return item;
}

export function nextId() {
  load();
  seq += 1;
  return `it-${seq}`;
}

export function remove(id) {
  load();
  const had = items.delete(id);
  if (had) flush();
  return had;
}
