// tasks.js — what a task is, and the two rules a caller can break.
//
// Both rules are stated here rather than in the handler, because the corpus
// quotes them by name and a rule that lives in a route is a rule that gets
// restated differently in the next route.
import * as store from "./store.js";

/** A title is required and is capped. An untitled task is a row nobody can act
 *  on, and an unbounded title is a denial-of-service with a text box in front
 *  of it. */
export const TITLE_MAX = 200;
/** The only states a task may be in. Anything else is refused by name, so a
 *  client with a typo gets told which word was wrong. */
export const STATES = ["open", "doing", "done"];

export const project = (t) => ({ id: t.id, title: t.title, state: t.state, version: t.version, created: t.created, updated: t.updated });

export function validate(body) {
  const why = [];
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) why.push({ field: "title", error: "required" });
  else if (title.length > TITLE_MAX) why.push({ field: "title", error: `longer than ${TITLE_MAX}`, length: title.length });
  const state = body?.state === undefined ? "open" : body.state;
  if (!STATES.includes(state)) why.push({ field: "state", error: "not one of", allowed: STATES, got: state });
  return { ok: why.length === 0, title, state, why };
}

export function create(body) {
  const v = validate(body);
  if (!v.ok) return { error: v.why };
  const now = new Date().toISOString();
  return store.put({ id: store.next(), title: v.title, state: v.state, version: 1, created: now, updated: now });
}

export function update(id, body) {
  const t = store.get(id);
  if (!t) return null;
  const v = validate({ title: body?.title ?? t.title, state: body?.state ?? t.state });
  if (!v.ok) return { error: v.why };
  // The version increments on every accepted write. A 200 that stored nothing
  // and a 200 that stored something are identical from the outside without it.
  return store.put({ ...t, title: v.title, state: v.state, version: t.version + 1, updated: new Date().toISOString() });
}
