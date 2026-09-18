// run.mjs — the measured experiment.
//
// One task, one arm, one repeat is a run. Everything about a run is identical
// across arms except the tree: both get the problem sentence as the prompt,
// and the packed arm's tree has bundlebox wired into it. Same model, same
// tools, same turn limit, same gate, same throwaway tree otherwise.
//
// MCP is disabled on both arms (--strict-mcp-config with an empty config), so
// the packed arm cannot reach bundlebox's tools at run time. What it has is
// what `bb wire --apply` installs: the UserPromptSubmit hook that locates the
// task and injects the map, and the read and search guards that serve the
// quoted regions. Both arms get the same prompt; the brief never enters it.
// A packed run in which the hook wrote no brief is voided, not counted.
//
// Success is binary and objective: `npm test` fails before the run and must
// pass after it. The test files are hashed before and after — an agent that
// deletes a failing test has not fixed anything, and that run is marked void.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { MUTATIONS } from "./mutations.mjs";
import { materialise, applyMutation, gate, ROOT } from "./prepare.mjs";
import { wire, briefWritten, envFor } from "./brief.mjs";

const MODEL = process.env.BENCH_MODEL || "claude-sonnet-5";
const MAX_TURNS = Number(process.env.BENCH_MAX_TURNS || 40);
const REPEATS = Number(process.env.BENCH_REPEATS || 3);
const ONLY = process.env.BENCH_ONLY ? process.env.BENCH_ONLY.split(",") : null;
const OUT = path.join(import.meta.dirname, "var", "runs.jsonl");

const GATE_LINE = "The gate is `npm test`. It fails right now. Make it pass without editing any file under test/.";

function hashTests(tree) {
  const dir = path.join(tree, "test");
  return fs.readdirSync(dir).sort().map((f) => {
    const h = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex").slice(0, 12);
    return `${f}:${h}`;
  }).join(" ");
}

function runAgent(tree, prompt) {
  const started = Date.now();
  let raw = "";
  try {
    raw = execFileSync("claude", [
      "-p", prompt,
      "--model", MODEL,
      "--output-format", "json",
      "--max-turns", String(MAX_TURNS),
      "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--dangerously-skip-permissions",
    ], { cwd: tree, encoding: "utf8", timeout: 1_800_000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], env: envFor(tree) });
  } catch (e) {
    raw = e.stdout || "";
    if (!raw) return { error: `${e.stderr || e.message}`.trim().slice(0, 400), wallMs: Date.now() - started };
  }
  try {
    return { ...JSON.parse(raw), wallMs: Date.now() - started };
  } catch {
    return { error: "unparseable agent output", wallMs: Date.now() - started, raw: raw.slice(0, 500) };
  }
}

function one(mutation, arm, repeat) {
  const tag = `${mutation.id}/${arm}/r${repeat}`;
  const tree = materialise(arm === "packed" ? "sampleThree" : "sampleFour",
                           path.join(os.tmpdir(), `bench-${process.pid}-${mutation.id}-${arm}-${repeat}`));
  applyMutation(tree, mutation);

  const before = gate(tree);
  if (before.pass) return { tag, void: true, why: "gate passed before the run; the defect did not take" };
  const testsBefore = hashTests(tree);

  // Same prompt on both arms. The packed arm's difference is the tree, which
  // has bundlebox wired into it; the hook locates the task when the prompt
  // lands and the guards serve the regions when a read asks.
  const prompt = `${mutation.problem}\n\n${GATE_LINE}`;
  const wired = arm === "packed" ? wire(tree) : null;

  const r = runAgent(tree, prompt);
  const served = arm === "packed" ? briefWritten(tree) : null;
  if (arm === "packed" && !served) {
    fs.rmSync(tree, { recursive: true, force: true });
    console.log(`${tag.padEnd(34)} VOID      the hook wrote no brief; a packed run with no brief is a bare run under the wrong label`);
    return { tag, void: true, why: "hook wrote no brief" };
  }
  const after = gate(tree);
  const testsAfter = hashTests(tree);
  const testsTouched = testsBefore !== testsAfter;

  const u = r.usage || {};
  const row = {
    at: new Date().toISOString(), task: mutation.id, arm, repeat, model: MODEL,
    solved: after.pass && !testsTouched,
    tests_touched: testsTouched,
    failed_before: before.failed.length, failed_after: after.failed,
    prompt_chars: prompt.length, brief_chars: served?.chars ?? 0, brief_ms: served?.ms ?? null, brief_via: arm === "packed" ? "hook" : null, wire_ms: wired?.ms ?? null,
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_read_input_tokens: u.cache_read_input_tokens ?? null,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? null,
    total_tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    cost_usd: r.total_cost_usd ?? null,
    ttft_ms: r.ttft_ms ?? null,
    duration_ms: r.duration_ms ?? null,
    duration_api_ms: r.duration_api_ms ?? null,
    wall_ms: r.wallMs,
    num_turns: r.num_turns ?? null,
    terminal_reason: r.terminal_reason ?? null,
    is_error: r.is_error ?? null,
    error: r.error ?? null,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
  fs.rmSync(tree, { recursive: true, force: true });
  console.log(`${tag.padEnd(34)} ${row.solved ? "SOLVED" : "unsolved"}  ${String(row.total_tokens).padStart(8)} tok  $${(row.cost_usd ?? 0).toFixed(4)}  ${row.num_turns} turns  ttft ${row.ttft_ms}ms`);
  return row;
}

// Resume: a run already on disk is not repeated, so a killed job costs nothing.
const done = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
    try { const r = JSON.parse(line); done.add(`${r.task}/${r.arm}/${r.repeat}`); } catch {}
  }
}

const tasks = MUTATIONS.filter((m) => !ONLY || ONLY.includes(m.id));
console.log(`${tasks.length} task(s) x 2 arms x ${REPEATS} repeat(s) = ${tasks.length * 2 * REPEATS} runs on ${MODEL}\n`);
let skipped = 0;
for (const m of tasks) for (let r = 1; r <= REPEATS; r++) for (const arm of ["bare", "packed"]) {
  if (done.has(`${m.id}/${arm}/${r}`)) { skipped++; continue; }
  one(m, arm, r);
}
if (skipped) console.log(`(${skipped} run(s) already on disk, skipped)`);
console.log(`\nwrote ${OUT}`);
