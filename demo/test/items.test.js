import { test } from "node:test";
import assert from "node:assert/strict";
import * as items from "../src/items.js";
import * as store from "../src/store.js";

process.env.DEMO_STORE = "/tmp/bundlebox-demo-test/items.json";

test("create round-trips with version 1 and an it- id", () => {
  store.reset();
  const it = items.create({ title: "audit the wire" });
  assert.match(it.id, /^it-\d+$/);
  assert.equal(it.version, 1);
  assert.equal(items.read(it.id).title, "audit the wire");
});

test("a title is required", () => {
  store.reset();
  assert.throws(() => items.create({ title: "  " }), /title: required/);
});

test("an unknown state is refused", () => {
  store.reset();
  assert.throws(() => items.create({ title: "x", state: "pending" }), /state: one of/);
});

test("update bumps the version", () => {
  store.reset();
  const it = items.create({ title: "one" });
  const next = items.update(it.id, { title: "two" });
  assert.equal(next.version, 2);
  assert.equal(next.title, "two");
});

test("update of a missing id is null, not a throw", () => {
  store.reset();
  assert.equal(items.update("it-999", { title: "x" }), null);
});

test("list filters by state", () => {
  store.reset();
  items.create({ title: "a", state: "open" });
  items.create({ title: "b", state: "done" });
  assert.equal(items.list({ state: "done" }).length, 1);
});
