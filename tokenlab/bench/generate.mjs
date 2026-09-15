#!/usr/bin/env node
// generate.mjs — trees of a known size, so the saving can be measured as a
// function of the thing it actually depends on.
//
// The headline number from `bb bench` on one repository is not a property of
// bundlebox. It is a property of bundlebox AND that repository: packing a task
// out of a 400-file tree removes far more than packing the same task out of a
// 12-file one, because the bare arm is what grows. A single percentage with no
// tree behind it is unfalsifiable, so this writes three trees and the lab runs
// the same tasks in each.
//
// The files are synthetic but not noise: each module has real declarations, a
// plausible import graph and a shared vocabulary, because both arms depend on
// a search returning something. A tree of lorem ipsum makes the bare arm read
// nothing and reports a saving of zero for the wrong reason.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(HERE, "..", "var", "trees");

export const SCALES = [
  { id: "small", files: 12, note: "one weekend's worth of code" },
  { id: "medium", files: 80, note: "a service a team owns" },
  { id: "large", files: 400, note: "a monorepo package" },
];

const DOMAINS = ["billing", "invoice", "ledger", "payment", "refund", "subscription", "tax", "wallet", "payout", "dispute"];
const VERBS = ["create", "settle", "reconcile", "void", "capture", "refund", "post", "apply", "resolve", "quote"];

const pick = (xs, i) => xs[i % xs.length];

/** One module: a header that says what it is, a few exported functions that
 *  name the domain, and imports of its neighbours so the tree has a shape. */
function moduleText(i, total) {
  const d = pick(DOMAINS, i), d2 = pick(DOMAINS, i + 3);
  const imports = [];
  for (let k = 1; k <= 3; k++) {
    const j = (i + k * 7) % total;
    if (j !== i) imports.push(`import { ${pick(VERBS, j)}${cap(pick(DOMAINS, j))} } from "./mod${j}.js";`);
  }
  const fns = VERBS.slice(0, 4 + (i % 4)).map((v, k) => `
/** ${v} a ${d}: the ${d2} side is settled first so a partial ${d} cannot be
 *  observed by a reader between the two writes. */
export function ${v}${cap(d)}(${d}, opts = {}) {
  const state = { id: ${d}.id, at: Date.now(), attempt: ${k + 1} };
  if (!${d}.id) throw new Error("${v}${cap(d)}: no id");
  const applied = opts.dry ? state : { ...state, applied: true };
  return { ...applied, kind: "${d}", via: "${v}", peer: "${d2}" };
}`).join("\n");
  return `// mod${i}.js — the ${d} side of ${d2}. Module ${i} of ${total}.
//
// Everything a caller of this module needs is in the exports below; the
// internals are the ordering rules between ${d} and ${d2}.
${imports.join("\n")}

export const ${d.toUpperCase()}_STATES = ["pending", "settled", "voided"];
export const ${d.toUpperCase()}_RETRY_MAX = ${3 + (i % 5)};
${fns}

export default { ${VERBS.slice(0, 2).map((v) => `${v}${cap(d)}`).join(", ")} };
`;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function generate({ force = false } = {}) {
  const made = [];
  for (const sc of SCALES) {
    const dir = path.join(ROOT, sc.id);
    if (fs.existsSync(dir) && !force) { made.push({ ...sc, dir, state: "kept" }); continue; }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    for (let i = 0; i < sc.files; i++) fs.writeFileSync(path.join(dir, "src", `mod${i}.js`), moduleText(i, sc.files));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
      name: `tokenlab-${sc.id}`, version: "0.0.0", private: true, type: "module",
      scripts: { lint: "node -e \"process.exit(0)\"", test: "node -e \"process.exit(0)\"" },
    }, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "README.md"), `# tokenlab-${sc.id}\n\nA generated tree of ${sc.files} modules — ${sc.note}.\nWritten by tokenlab/bench/generate.mjs; nothing here is hand-edited.\n`);
    made.push({ ...sc, dir, state: "written" });
  }
  return made;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes("--force");
  for (const m of generate({ force })) console.log(`  ${m.id.padEnd(8)} ${String(m.files).padStart(4)} files  ${m.state}  ${m.dir}`);
}
