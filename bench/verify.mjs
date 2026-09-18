// verify.mjs — does each mutation apply, and does it break the test it claims?
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { MUTATIONS } from "./mutations.mjs";
import { materialise, applyMutation, gate } from "./prepare.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bench-verify-"));
let ok = 0;

console.log("baseline (no mutation):");
const clean = materialise("sampleFour", path.join(tmp, "clean"));
const base = gate(clean);
console.log(`  npm test ${base.pass ? "PASS" : "FAIL — " + base.failed.slice(0,3).join("; ")}\n`);
if (!base.pass) process.exit(1);

for (const m of MUTATIONS) {
  const tree = materialise("sampleFour", path.join(tmp, m.id));
  try { applyMutation(tree, m); } catch (e) { console.log(`  ${m.id}: APPLY FAILED — ${e.message}`); continue; }
  const g = gate(tree);
  const hit = g.failed.includes(m.breaks);
  console.log(`${m.id}`);
  console.log(`  gate: ${g.pass ? "PASS (bug not caught!)" : `FAIL, ${g.failed.length} test(s)`}`);
  console.log(`  names its test: ${hit ? "yes" : "NO — got: " + g.failed.slice(0,2).join("; ")}`);
  if (!g.pass && hit) ok++;
}
console.log(`\n${ok} of ${MUTATIONS.length} mutations verified`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(ok === MUTATIONS.length ? 0 : 1);
