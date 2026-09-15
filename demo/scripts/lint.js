#!/usr/bin/env node
// lint.js — `node --check` over every source file. No dependency, no config,
// and it is what package.json's `lint` script promises: a script a gate detects
// and cannot run is worse than no script at all.
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const files = [];
const stack = ["src", "test", "web", "scripts"].map((d) => path.join(process.cwd(), d));
while (stack.length) {
  const d = stack.pop();
  let entries;
  try { entries = readdirSync(d); } catch { continue; }
  for (const e of entries) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) stack.push(p);
    else if (p.endsWith(".js") || p.endsWith(".mjs")) files.push(p);
  }
}
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) { bad++; process.stderr.write(r.stderr); }
}
console.log(`${files.length} files checked, ${bad} with errors`);
process.exit(bad ? 1 : 0);
