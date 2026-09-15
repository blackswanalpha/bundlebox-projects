// server.test.js — the route table and the handler, without opening a socket.
// `ROUTES` and `handle` are exported so this file can reach them; an exported
// surface with no consumer is one `bb scan` correctly calls dead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { ROUTES, handle } from "../src/server.js";
import * as store from "../src/store.js";
import { FIELDS } from "../src/items.js";

process.env.DEMO_STORE = "/tmp/bundlebox-demo-test/server.json";

/** A request and a response that record instead of writing to a socket. */
function call(method, url, body) {
  // Buffers, not strings: that is what an http request yields, and the server
  // concatenates them as such.
  const req = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = url;
  const res = { code: 0, headers: {}, body: "",
    writeHead(c, h) { this.code = c; Object.assign(this.headers, h || {}); return this; },
    end(b) { this.body = b == null ? "" : String(b); this.done = true; return this; } };
  return handle(req, res).then(() => ({ ...res, json: res.body ? JSON.parse(res.body) : null }));
}

test("every route declares a method, a pattern and a name", () => {
  assert.ok(ROUTES.length >= 6);
  const names = new Set();
  for (const r of ROUTES) {
    assert.match(r.method, /^(GET|POST|PATCH|DELETE)$/);
    assert.ok(r.path instanceof RegExp, `${r.name} has a pattern`);
    assert.equal(typeof r.handle, "function");
    assert.ok(!names.has(`${r.method} ${r.name}`), `${r.name} is declared once`);
    names.add(`${r.method} ${r.name}`);
  }
});

test("health answers before anything has been written", async () => {
  store.reset();
  const r = await call("GET", "/health");
  assert.equal(r.code, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.items, 0);
});

test("a created item comes back with exactly the wire fields", async () => {
  store.reset();
  const made = await call("POST", "/items", { title: "ship it" });
  assert.equal(made.code, 201);
  assert.deepEqual(Object.keys(made.json).sort(), [...FIELDS].sort(),
    "the response is projected through FIELDS, so a store-only field never leaks");
  const read = await call("GET", `/items/${made.json.id}`);
  assert.equal(read.code, 200);
  assert.equal(read.json.title, "ship it");
});

test("an invalid body is 422 and names the field", async () => {
  store.reset();
  const r = await call("POST", "/items", { title: "" });
  assert.equal(r.code, 422);
  assert.equal(r.json.field, "title");
});

test("a missing item is 404 on read, update and delete", async () => {
  store.reset();
  for (const [method, body] of [["GET", null], ["PATCH", { title: "x" }], ["DELETE", null]]) {
    const r = await call(method, "/items/it-999", body);
    assert.equal(r.code, 404, `${method} of a missing id`);
  }
});

test("an unknown route is 404 and does not fall through to a file", async () => {
  const r = await call("GET", "/nope");
  assert.equal(r.code, 404);
  assert.equal(r.json.error, "no such route");
});
