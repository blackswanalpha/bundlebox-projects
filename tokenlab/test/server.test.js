// The surface `bb cookbook` asserts against. Started on an ephemeral port so
// the suite does not collide with a running lab.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
process.env.TOKENLAB_STORE = path.join(os.tmpdir(), `tokenlab-srv-${process.pid}.json`);
const { serve } = await import("../src/server.js");
const store = await import("../src/store.js");

let base, server;
before(async () => { store.reset(); const s = await serve(0); server = s.server; base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

const call = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
};

test("health says what it is", async () => {
  const r = await call("GET", "/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.service, "tokenlab");
});

test("a create round-trips and is in the list", async () => {
  const c = await call("POST", "/tasks", { title: "round trip" });
  assert.equal(c.status, 201);
  assert.match(c.body.id, /^tk-\d+$/);
  const g = await call("GET", `/tasks/${c.body.id}`);
  assert.equal(g.body.title, "round trip");
  const l = await call("GET", "/tasks");
  assert.ok(l.body.some((t) => t.id === c.body.id));
});

test("a missing task names the id it could not find", async () => {
  const r = await call("GET", "/tasks/tk-99999");
  assert.equal(r.status, 404);
  assert.equal(r.body.id, "tk-99999");
});

test("an undeclared route is 404 and a wrong method is 405 with the allowed set", async () => {
  assert.equal((await call("GET", "/nope")).status, 404);
  const r = await call("DELETE", "/health");
  assert.equal(r.status, 405);
  assert.deepEqual(r.body.allowed, ["GET"]);
});

test("delete removes it and the second delete is a 404, not a second success", async () => {
  const c = await call("POST", "/tasks", { title: "temporary" });
  assert.equal((await call("DELETE", `/tasks/${c.body.id}`)).status, 204);
  assert.equal((await call("DELETE", `/tasks/${c.body.id}`)).status, 404);
});
