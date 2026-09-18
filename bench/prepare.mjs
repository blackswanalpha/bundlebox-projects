// prepare.mjs — a pristine, runnable copy of an arm's tree with one bug in it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = path.resolve(import.meta.dirname, "..");

/** Copy an arm's tree to `dest`, symlinking node_modules so a run costs no install. */
export function materialise(arm, dest) {
  const src = path.join(ROOT, arm);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  execFileSync("rsync", ["-a", "--exclude", "node_modules", "--exclude", "dist",
                         "--exclude", ".expo", `${src}/`, `${dest}/`]);
  fs.symlinkSync(path.join(ROOT, "sampleThree", "node_modules"), path.join(dest, "node_modules"), "dir");
  return dest;
}

/** Apply one mutation. Throws unless the target string appears exactly once. */
export function applyMutation(tree, mutation) {
  const file = path.join(tree, mutation.file);
  const before = fs.readFileSync(file, "utf8");
  const hits = before.split(mutation.find).length - 1;
  if (hits !== 1) throw new Error(`${mutation.id}: target appears ${hits} times in ${mutation.file}, expected exactly 1`);
  fs.writeFileSync(file, before.replace(mutation.find, mutation.replace));
}

/** Run the gate. Returns {pass, failed:[test names], out}. */
export function gate(tree) {
  try {
    const out = execFileSync("npm", ["test"], { cwd: tree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });
    return { pass: true, failed: [], out };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const failed = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
    return { pass: false, failed, out };
  }
}
