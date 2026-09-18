// summarise.mjs — runs.jsonl -> the numbers the comparison renders.
//
// Median, not mean: three runs is enough for a middle value and a spread, and
// a mean of three lets one long run carry the headline. Unsolved runs stay in
// the token and latency figures — an arm that spends tokens and does not fix
// the bug still spent them — but the solved count is reported next to every
// number so a cheap failure cannot read as a win.
import fs from "node:fs";
import path from "node:path";

const IN = path.join(import.meta.dirname, "var", "runs.jsonl");
const OUT = path.join(import.meta.dirname, "var", "summary.json");

const rows = fs.readFileSync(IN, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const median = (xs) => {
  const s = [...xs].filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

function cell(task, arm) {
  const rs = rows.filter((r) => r.task === task && r.arm === arm);
  if (!rs.length) return null;
  return {
    n: rs.length,
    solved: rs.filter((r) => r.solved).length,
    tests_touched: rs.filter((r) => r.tests_touched).length,
    tokens: median(rs.map((r) => r.total_tokens)),
    tokens_min: Math.min(...rs.map((r) => r.total_tokens)),
    tokens_max: Math.max(...rs.map((r) => r.total_tokens)),
    input: median(rs.map((r) => r.input_tokens)),
    output: median(rs.map((r) => r.output_tokens)),
    cache_read: median(rs.map((r) => r.cache_read_input_tokens)),
    cache_write: median(rs.map((r) => r.cache_creation_input_tokens)),
    cost: rs.map((r) => r.cost_usd ?? 0).sort((a, b) => a - b)[Math.floor(rs.length / 2)],
    ttft_ms: median(rs.map((r) => r.ttft_ms)),
    wall_ms: median(rs.map((r) => r.duration_ms)),
    turns: median(rs.map((r) => r.num_turns)),
  };
}

const tasks = [...new Set(rows.map((r) => r.task))];
const perTask = tasks.map((t) => ({ task: t, bare: cell(t, "bare"), packed: cell(t, "packed") }));

function total(arm) {
  const rs = rows.filter((r) => r.arm === arm);
  const byTask = tasks.map((t) => cell(t, arm)).filter(Boolean);
  return {
    runs: rs.length,
    solved: rs.filter((r) => r.solved).length,
    tests_touched: rs.filter((r) => r.tests_touched).length,
    tokens: byTask.reduce((s, c) => s + (c.tokens ?? 0), 0),
    cost: byTask.reduce((s, c) => s + (c.cost ?? 0), 0),
    ttft_ms: median(byTask.map((c) => c.ttft_ms)),
    wall_ms: byTask.reduce((s, c) => s + (c.wall_ms ?? 0), 0),
    turns: byTask.reduce((s, c) => s + (c.turns ?? 0), 0),
    spend_total: rs.reduce((s, r) => s + (r.cost_usd ?? 0), 0),
    // Per SOLVED task, not per run: a cheap run that did not fix the bug is
    // not cheaper, and dividing by runs would let it flatter the number.
    cost_per_solved: rs.some((r) => r.solved) ? rs.reduce((s, r) => s + (r.cost_usd ?? 0), 0) / rs.filter((r) => r.solved).length : null,
  };
}

const summary = {
  at: new Date().toISOString(),
  kind: "MEASURED",
  method: "Claude Code headless (claude -p), MCP disabled on both arms, identical prompt, tools and turn limit. The only difference is the tree: the packed arm's has bundlebox wired into it (`bb wire --apply`), so the UserPromptSubmit hook locates the task and the read guard serves the quoted regions; the brief never enters the prompt. Gate is `npm test`, binary; test files are hashed before and after and a run that edits them is not counted solved. Cost is reported per solved task.",
  model: rows[0]?.model ?? null,
  repeats: Math.max(...tasks.map((t) => rows.filter((r) => r.task === t && r.arm === "bare").length)),
  tasks: perTask,
  totals: { bare: total("bare"), packed: total("packed") },
};
summary.totals.spend_all = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);

fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

const b = summary.totals.bare, p = summary.totals.packed;
const pct = b.tokens ? ((b.tokens - p.tokens) / b.tokens * 100) : 0;
console.log(`${rows.length} runs, ${summary.repeats} repeat(s)/cell, model ${summary.model}`);
console.log(`${"".padEnd(10)} ${"tokens".padStart(10)} ${"cost".padStart(9)} ${"ttft".padStart(8)} ${"wall".padStart(9)} ${"solved".padStart(8)}`);
console.log(`${"bare".padEnd(10)} ${b.tokens.toLocaleString().padStart(10)} ${("$"+b.cost.toFixed(3)).padStart(9)} ${(b.ttft_ms+"ms").padStart(8)} ${(Math.round(b.wall_ms/1000)+"s").padStart(9)} ${(b.solved+"/"+b.runs).padStart(8)}`);
console.log(`${"packed".padEnd(10)} ${p.tokens.toLocaleString().padStart(10)} ${("$"+p.cost.toFixed(3)).padStart(9)} ${(p.ttft_ms+"ms").padStart(8)} ${(Math.round(p.wall_ms/1000)+"s").padStart(9)} ${(p.solved+"/"+p.runs).padStart(8)}`);
console.log(`\npacked uses ${pct >= 0 ? pct.toFixed(1)+"% fewer" : (-pct).toFixed(1)+"% MORE"} tokens than bare`);
const cps = (t) => (t.cost_per_solved == null ? "n/a (nothing solved)" : `$${t.cost_per_solved.toFixed(4)}`);
console.log(`cost per solved task: bare ${cps(b)}, packed ${cps(p)}${b.cost_per_solved != null && p.cost_per_solved != null ? ` — packed ${p.cost_per_solved < b.cost_per_solved ? "cheaper" : "MORE expensive"} per fix` : ""}`);
console.log(`total spend on this matrix: $${summary.totals.spend_all.toFixed(2)}`);
