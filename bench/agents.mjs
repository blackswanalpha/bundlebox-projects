// agents.mjs — the second dimension of the matrix: which agent ran the arm.
//
// The levelling claim is that a brief compresses the spread between models by
// moving work from search and judgement to a named edit against a named gate.
// Until now it had never been run against a second pairing, so it was a
// prediction from the shape of the work rather than a measurement. Four agents
// are installed and verified on this box — claude 2.1.276, codex 0.111.0,
// gemini 0.39.1, opencode 1.18.31 — and each has an adapter in bundlebox that
// already knows how to invoke it headless and how to read its token counts.
//
// Nothing here invents a flag. Every argv comes from `src/adapters/<name>.js`,
// where each flag was either read off `<bin> --help` on a box that has the
// binary or copied from vendor docs and marked unverified. The adapter's own
// `note` is carried into the row, so a cell whose event shape was never
// verified says so in the output instead of quietly reporting zeros.
//
// Claude keeps the invocation it was measured on. `run.mjs` has been calling
// `claude -p --output-format json` since the 18/18 baseline was taken, and
// changing how the baseline arm is spawned would make the new numbers
// incomparable with the old ones. The other three go through the adapters.
// The row records `via`, so the two paths are never confused for one.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { BB, envFor } from "./brief.mjs";

const SRC = path.resolve(path.dirname(BB), "..", "src");
const { ADAPTERS } = await import(pathToFileURL(path.join(SRC, "adapters", "index.js")).href);

/** Which agents this matrix runs. One by default: a second agent multiplies
 *  the spend by the number of cells, and that is the operator's call. */
export const AGENTS = (process.env.BENCH_AGENTS || "claude").split(",").map((s) => s.trim()).filter(Boolean);

/** Is this agent's binary on the box? A cell for an agent that is not
 *  installed is reported as absent, never as unsolved: a missing binary is a
 *  fact about the box, and counting it as a failure would let an uninstalled
 *  agent read as one that could not fix the bug. */
export function installed(agent) {
  const a = ADAPTERS[agent];
  if (!a) return null;
  try { return a.detect(); } catch { return null; }
}

/** Fold the adapter's own event parser over the agent's stdout.
 *
 *  A result event wins when one arrives, because an agent that reports a final
 *  total has counted its own turns better than this loop can. Otherwise the
 *  per-turn rows are summed. `null` for every field when the agent emitted
 *  nothing this parser recognised — not zero, which would read as a free run. */
export function foldUsage(adapter, stdout) {
  let result = null;
  const per = new Map();
  let turns = 0;
  for (const line of String(stdout || "").split("\n")) {
    let e = null;
    try { e = adapter.parseEvent(line); } catch { e = null; }
    if (!e) continue;
    if (e.isResult && e.resultUsage) { result = e.resultUsage; continue; }
    if (e.msgId == null) continue;
    // Keyed by message id: an agent that re-emits a turn as it streams would
    // otherwise be counted once per chunk.
    per.set(e.msgId, e);
  }
  turns = per.size;
  const sum = (k) => [...per.values()].reduce((a, x) => a + (Number(x[k]) || 0), 0);
  const u = result || (per.size ? { input: sum("input"), output: sum("output"), cacheRead: sum("cacheRead"), cacheWrite: sum("cacheWrite") } : null);
  if (!u) return { input: null, output: null, cacheRead: null, cacheWrite: null, total: null, turns: turns || null, counted: false };
  const total = (Number(u.input) || 0) + (Number(u.output) || 0) + (Number(u.cacheRead) || 0) + (Number(u.cacheWrite) || 0);
  return { input: u.input ?? null, output: u.output ?? null, cacheRead: u.cacheRead ?? null, cacheWrite: u.cacheWrite ?? null,
    total, turns: turns || null, counted: true };
}

/** Run one agent over one tree. Returns the same shape whatever the agent, so
 *  the row `run.mjs` writes does not branch on which one it was. */
export function spawnAgent(agent, tree, prompt, { model = "", maxTurns = 0, timeoutMs = 1_800_000 } = {}) {
  const adapter = ADAPTERS[agent];
  if (!adapter) return { error: `no adapter for ${agent}`, wallMs: 0, usage: null, note: "" };
  const built = adapter.buildCmd({ prompt, promptFile: "", cwd: tree, model, maxTurns, permissionMode: "acceptEdits", lean: false });
  if (!built?.argv?.length) return { error: `${agent}: adapter produced no argv`, wallMs: 0, usage: null, note: built?.note || "" };
  const [bin, ...args] = built.argv;
  const started = Date.now();
  let out = "";
  try {
    out = execFileSync(bin, args, {
      cwd: tree, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024,
      input: built.stdin === "prompt" ? prompt : undefined,
      stdio: [built.stdin === "prompt" ? "pipe" : "ignore", "pipe", "pipe"],
      env: { ...envFor(tree), ...(built.env || {}) },
    });
  } catch (e) {
    out = e.stdout || "";
    if (!out) return { error: `${e.stderr || e.message}`.trim().slice(0, 400), wallMs: Date.now() - started, usage: null, note: built.note || "" };
  }
  return { wallMs: Date.now() - started, usage: foldUsage(adapter, out), note: built.note || "", via: "adapter" };
}

/** Wire the tree for THIS agent. The packed arm's whole difference is that the
 *  tree has bundlebox installed for the agent about to run in it; wiring it for
 *  claude and then running codex would be a bare run under the wrong label. */
export function wireFor(agent, tree) {
  const started = Date.now();
  execFileSync(BB, ["wire", "--agents", agent, "--apply"], {
    cwd: tree, encoding: "utf8", timeout: 120000, env: envFor(tree), stdio: ["ignore", "pipe", "pipe"],
  });
  return { ms: Date.now() - started };
}

// What the packed arm actually needs, and what each agent can give it.
//
// This is the finding that came out of building the matrix, and it is not the
// one the plan expected. The packed arm is a tree with bundlebox wired into it;
// its two halves are the PROMPT hook, which locates the task and injects the
// map when the prompt lands, and the READ guard, which serves the quoted region
// when a read asks for one. Reading `src/wire/agents.js` on this box:
//
//   claude    both. UserPromptSubmit plus PreToolUse, verified on 2.1.276.
//   opencode  guard only. A plugin at `tool.execute.before`, which is a
//             pre-tool point; OpenCode has no prompt event, so nothing locates
//             the task and no brief is ever written.
//   cursor    guard only, and the shape is unverified vendor documentation.
//   codex     neither. `notify` is a notification point and cannot deny a tool
//             call, which `AGENT_HOOKS.codex` says in as many words.
//   gemini    neither. It has no entry at all.
//
// So a packed cell is constructible for claude today and for nobody else. An
// agent without a prompt hook running in a wired tree is a BARE run wearing a
// packed label, which is the exact failure `run.mjs` already voids claude runs
// for. It is voided here too, before the spend, rather than after it.
//
// `wire.agent_hooks` is also off by default, so even the guard-only agents need
// it turned on before their tree differs from bare at all.

/** Can this agent's packed arm be built? `why` is printed on the void. */
export function packable(agent) {
  if (agent === "claude") return { ok: true, why: "" };
  if (agent === "opencode" || agent === "cursor") {
    return { ok: false, why: `${agent} has a pre-tool guard but no prompt hook, so nothing locates the task and no brief is written; a packed cell here would be a bare run under a packed label` };
  }
  return { ok: false, why: `${agent} has no hook surface bundlebox can install a guard into (see AGENT_HOOKS in src/wire/agents.js); its packed arm cannot be built` };
}

/** The bare arm, though, works for every agent that is installed — and a bare
 *  cell is still a measurement. A weaker agent that also goes 18/18 bare says
 *  the fixtures are too easy, which is the prerequisite the plan named for
 *  every claim in this section. */
export const bareOnly = (agent) => !packable(agent).ok;
