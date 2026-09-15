// items.js — what an item is, and the only place that decides it.
import * as store from "./store.js";

// The wire shape. The server projects every response through it, so a field
// added to the store for its own reasons does not become a public one by
// accident.
export const FIELDS = ["id", "title", "due", "state", "version", "created", "updated"];
export const project = (it) => (it ? Object.fromEntries(FIELDS.map((k) => [k, it[k]])) : it);
const STATES = ["open", "doing", "done"];

class Invalid extends Error {
  constructor(field, why) { super(`${field}: ${why}`); this.field = field; this.why = why; this.status = 422; }
}

// Internal: `create` and `update` are the only callers, and a second entry
// point into validation is how two callers come to disagree about what an item
// is.
function validate(body) {
  const title = String(body?.title ?? "").trim();
  if (!title) throw new Invalid("title", "required");
  if (title.length > 200) throw new Invalid("title", "at most 200 characters");
  const due = body?.due == null ? null : String(body.due);
  if (due && Number.isNaN(Date.parse(due))) throw new Invalid("due", "not a date");
  const state = body?.state == null ? "open" : String(body.state);
  if (!STATES.includes(state)) throw new Invalid("state", `one of ${STATES.join(", ")}`);
  return { title, due, state };
}

export function create(body) {
  const clean = validate(body);
  const now = new Date().toISOString();
  return store.put({ id: store.nextId(), ...clean, version: 1, created: now, updated: now });
}

export function update(id, body) {
  const current = store.get(id);
  if (!current) return null;
  const clean = validate({ ...current, ...body });
  return store.put({ ...current, ...clean, version: current.version + 1, updated: new Date().toISOString() });
}

export const list = ({ state = null } = {}) => store.all().filter((it) => !state || it.state === state);
export const read = (id) => store.get(id);
export const drop = (id) => store.remove(id);
