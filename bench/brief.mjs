// brief.mjs — how the packed arm gets its brief: through the hook, not the prompt.
//
// The first matrix ran `bb pinpoint` serially before the session and pasted
// the whole brief into the prompt. Two things were wrong with that. The 534 ms
// the locate takes sat on the session's time-to-first-token, where the
// UserPromptSubmit hook overlaps it with startup; and a brief pasted into the
// prompt is a surface no wired agent ever sees. A wired agent gets the map
// through the hook and the regions through the read guard, at the moment a
// read asks for one. So the packed arm is now a tree with bundlebox wired into
// it, and both arms get the same prompt.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const BB = "/home/mbugua/Documents/CodeBase/bundlebox/bin/bb";

/** The environment the agent and its hooks run in: `bb` on PATH, and the
 *  tree as the workspace root so a hook spawned in it resolves nothing else. */
export const envFor = (tree) => ({ ...process.env, BB_ROOT: tree, PATH: `${path.dirname(BB)}:${process.env.PATH || ""}` });

/** Install bundlebox's Claude Code hooks, instructions block and skills into
 *  the tree, exactly as `bb wire --apply` does on any project. Measured, so
 *  the setup cost is in the row and not hidden in the wall clock. */
export function wire(tree) {
  const started = Date.now();
  execFileSync(BB, ["wire", "--agents", "claude", "--apply"], {
    cwd: tree, encoding: "utf8", timeout: 120000, env: envFor(tree), stdio: ["ignore", "pipe", "pipe"],
  });
  return { ms: Date.now() - started };
}

/** The brief the hook wrote during the run, or null when it wrote none. A
 *  packed run with no brief is a bare run wearing the wrong label, and the
 *  caller voids it rather than counting it. `ms` is the locate time the hook
 *  logged, which the session did not wait for. */
export function briefWritten(tree) {
  const dir = path.join(tree, ".bundlebox", "out", "pinpoint");
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { return null; }
  if (!names.length) return null;
  const latest = names.map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
  const text = fs.readFileSync(path.join(dir, latest.f), "utf8");
  let ms = null;
  try {
    const log = fs.readFileSync(path.join(tree, ".bundlebox", "var", "hooks.log"), "utf8");
    const m = [...log.matchAll(/ prompt pinpoint .* in (\d+)ms$/gm)].pop();
    if (m) ms = Number(m[1]);
  } catch { /* the log is a courtesy */ }
  return { file: latest.f, chars: text.length, ms };
}
