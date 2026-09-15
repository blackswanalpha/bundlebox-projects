// The two rules a caller can break, and the one a writer can: a 200 that stored
// nothing looks identical to a 200 that stored something without `version`.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
process.env.TOKENLAB_STORE = path.join(os.tmpdir(), `tokenlab-${process.pid}.json`);
const tasks = await import("../src/tasks.js");
const store = await import("../src/store.js");

test("a task needs a title, and the refusal names the field", () => {
  store.reset();
  const r = tasks.create({ title: "  " });
  assert.deepEqual(r.error, [{ field: "title", error: "required" }]);
});

test("an unknown state is refused with the allowed set, not with 'invalid'", () => {
  store.reset();
  const r = tasks.create({ title: "x", state: "pendign" });
  assert.equal(r.error[0].field, "state");
  assert.deepEqual(r.error[0].allowed, tasks.STATES);
  assert.equal(r.error[0].got, "pendign");
});

test("a title longer than the cap is refused with its length", () => {
  store.reset();
  const r = tasks.create({ title: "x".repeat(tasks.TITLE_MAX + 1) });
  assert.equal(r.error[0].length, tasks.TITLE_MAX + 1);
});

test("version increments on every accepted write", () => {
  store.reset();
  const a = tasks.create({ title: "first" });
  assert.equal(a.version, 1);
  const b = tasks.update(a.id, { state: "doing" });
  assert.equal(b.version, 2);
  assert.equal(b.state, "doing");
});

test("updating an unknown id is null, and a bad update is an error — the two are not the same", () => {
  store.reset();
  assert.equal(tasks.update("tk-nope", { title: "x" }), null);
  const a = tasks.create({ title: "first" });
  assert.ok(tasks.update(a.id, { state: "nope" }).error);
});
