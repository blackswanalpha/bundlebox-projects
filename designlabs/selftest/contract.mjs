#!/usr/bin/env node
// contract.mjs — the structural self-test, runnable by node with no browser and
// no dependency. It asserts the studio's DECLARATIONS are internally consistent.
// What a state LOOKS like is a browser question and is not answered here; this
// file never prints a pass for something it did not measure.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));
const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
const fail = [];
const ok = [];
const check = (cond, msg) => (cond ? ok : fail).push(msg);

const system = read("system.json");
const names = fs.readdirSync(path.join(dir, "screens")).filter((n) => n.endsWith(".json") && n !== "index.json");
const screens = names.map((n) => ({ ...read(path.join("screens", n)), _file: n }));

check(screens.length > 0, `screens/ holds ${screens.length} screen(s)`);
const tokens = new Set(Object.keys(system.color.tokens));
for (const p of system.color.pairs) {
  check(tokens.has(p.fg) || /^#/.test(p.fg), `pair "${p.use}" names a real fg token (${p.fg})`);
  check(tokens.has(p.bg) || /^#/.test(p.bg), `pair "${p.use}" names a real bg token (${p.bg})`);
}
const ids = new Set();
for (const s of screens) {
  check(!ids.has(s.id), `${s._file}: id "${s.id}" is unique`);
  ids.add(s.id);
  check(Object.keys(s.states || {}).length > 0, `${s.id}: declares states`);
  for (const [n, st] of Object.entries(s.states || {})) {
    check(Boolean(st.label), `${s.id}/${n}: has a label`);
    check(Boolean(st.note || st.copy), `${s.id}/${n}: says what it shows`);
  }
  const nodes = new Set((s.flow || []).map((n) => n.node));
  for (const n of s.flow || []) for (const t of n.to || []) {
    check(nodes.has(t), `${s.id}: flow edge ${n.node} -> ${t} lands on a declared node`);
  }
}
const idx = path.join(dir, "screens", "index.json");
if (fs.existsSync(idx)) {
  const listed = new Set(read(path.join("screens", "index.json")));
  for (const n of names) check(listed.has(n), `screens/index.json lists ${n}`);
}

for (const line of ok) console.log("  ok    " + line);
for (const line of fail) console.log("  FAIL  " + line);
console.log(`\n${ok.length} passed, ${fail.length} failed. Visual state distinctness is a browser question and was not checked here.`);
process.exit(fail.length ? 1 : 0);
