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

// Every row carries `agent`; rows written before the matrix had a second
// dimension did not, and they were all claude.
const agentOf = (r) => r.agent || "claude";
const AGENTS = [...new Set(rows.map(agentOf))].sort();
const nums = (xs) => xs.filter((x) => typeof x === "number");

function cell(task, arm, agent = null) {
  const rs = rows.filter((r) => r.task === task && r.arm === arm && (!agent || agentOf(r) === agent));
  if (!rs.length) return null;
  // Tokens are null for an agent whose event shape this box could not read, and
  // null is carried through rather than coerced: a min of 0 over uncounted runs
  // would read as an arm that cost nothing.
  const toks = nums(rs.map((r) => r.total_tokens));
  return {
    n: rs.length,
    solved: rs.filter((r) => r.solved).length,
    tests_touched: rs.filter((r) => r.tests_touched).length,
    counted: toks.length,
    tokens: median(rs.map((r) => r.total_tokens)),
    tokens_min: toks.length ? Math.min(...toks) : null,
    tokens_max: toks.length ? Math.max(...toks) : null,
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

function total(arm, agent = null) {
  const rs = rows.filter((r) => r.arm === arm && (!agent || agentOf(r) === agent));
  if (!rs.length) return null;
  const byTask = tasks.map((t) => cell(t, arm, agent)).filter(Boolean);
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

// One block per agent. The levelling claim is about bare-vs-packed WITHIN an
// agent, never across them: two agents run under different flags on different
// event shapes, and a number that pooled them would be about the pooling.
const byAgent = AGENTS.map((agent) => {
  const arms = { bare: total("bare", agent), packed: total("packed", agent) };
  const rs = rows.filter((r) => agentOf(r) === agent);
  return {
    agent,
    // The three things a solved rate is ABOUT. A rate quoted without them is
    // quoting nothing, so they travel with every cell and not in a footnote.
    max_turns: [...new Set(rs.map((r) => r.max_turns).filter(Boolean))],
    trees: Object.fromEntries(["bare", "packed"].map((a) => [a, [...new Set(rs.filter((r) => r.arm === a).map((r) => r.tree).filter(Boolean))]])),
    via: [...new Set(rs.map((r) => r.via).filter(Boolean))],
    adapter_note: [...new Set(rs.map((r) => r.adapter_note).filter(Boolean))],
    packed_absent: !arms.packed ? "no packed cell was run for this agent" : "",
    arms,
  };
});

const summary = {
  at: new Date().toISOString(),
  kind: "MEASURED",
  method: "Headless agent runs, MCP disabled on both arms, identical prompt, tools and turn limit. The only difference is the tree: the packed arm's has bundlebox wired into it (`bb wire --apply`), so the prompt hook locates the task and the read guard serves the quoted regions; the brief never enters the prompt. Gate is `npm test`, binary; test files are hashed before and after and a run that edits them is not counted solved. Cost is reported per solved task. Claude is spawned as `claude -p --output-format json`, the invocation the first baseline was taken on; every other agent is spawned from its bundlebox adapter, and `via` on each row says which.",
  model: rows[0]?.model ?? null,
  agents: AGENTS,
  repeats: Math.max(...tasks.map((t) => rows.filter((r) => r.task === t && r.arm === "bare").length)),
  tasks: perTask,
  by_agent: byAgent,
  totals: { bare: total("bare"), packed: total("packed") },
};
summary.totals.spend_all = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);

fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

console.log(`${rows.length} runs, ${summary.repeats} repeat(s)/cell, ${AGENTS.length} agent(s): ${AGENTS.join(", ")}`);

const n = (x, w) => (x == null ? "-".padStart(w) : x.toLocaleString().padStart(w));
const cps = (t) => (t?.cost_per_solved == null ? "n/a" : `$${t.cost_per_solved.toFixed(4)}`);

// The matrix: one row per agent per arm, and the solved rate first, because it
// is the only column that says whether the run did the job.
console.log(`\n${"agent".padEnd(10)} ${"arm".padEnd(7)} ${"solved".padStart(8)} ${"tokens".padStart(11)} ${"counted".padStart(8)} ${"cost".padStart(9)} ${"ttft".padStart(8)} ${"wall".padStart(9)}`);
for (const a of byAgent) {
  for (const arm of ["bare", "packed"]) {
    const t = a.arms[arm];
    if (!t) { console.log(`${a.agent.padEnd(10)} ${arm.padEnd(7)} ${"not run".padStart(8)}`); continue; }
    const counted = tasks.map((x) => cell(x, arm, a.agent)).filter(Boolean).reduce((s, c) => s + c.counted, 0);
    console.log(`${a.agent.padEnd(10)} ${arm.padEnd(7)} ${(t.solved + "/" + t.runs).padStart(8)} ${n(t.tokens, 11)} ${(counted + "/" + t.runs).padStart(8)} ${("$" + t.cost.toFixed(3)).padStart(9)} ${((t.ttft_ms ?? "-") + "ms").padStart(8)} ${(Math.round((t.wall_ms ?? 0) / 1000) + "s").padStart(9)}`);
  }
}

// A ratio names the agent, the cap and the tree, or it is not printed. The rule
// is the whole point of the matrix: "1.36x" is a fact about one pairing, and a
// reader who cannot see which pairing cannot check it.
console.log("");
for (const a of byAgent) {
  const b = a.arms.bare, p = a.arms.packed;
  const named = a.max_turns.length && a.trees.bare.length && (!p || a.trees.packed.length);
  const where = `${a.agent}, cap ${a.max_turns.join("/") || "?"} turns, ${a.trees.bare.join("/") || "?"} bare vs ${a.trees.packed.join("/") || "?"} packed`;
  if (!p) { console.log(`${a.agent.padEnd(10)} no ratio: ${a.packed_absent}. Bare solved ${b.solved}/${b.runs} (${where}).`); continue; }
  if (!b.tokens || !p.tokens) { console.log(`${a.agent.padEnd(10)} no ratio: an arm reported no token counts this box could read (${where}).`); continue; }
  // A ratio whose rows do not carry the cap and the tree is withheld, not
  // footnoted. These rows were written before the matrix recorded either, and
  // the constants they ran under are in the code rather than in the data —
  // which is an assertion, and the reason this rule exists.
  if (!named) {
    console.log(`${a.agent.padEnd(10)} solved bare ${b.solved}/${b.runs}, packed ${p.solved}/${p.runs}. Token ratio withheld: these rows carry no ${a.max_turns.length ? "tree" : "turn cap"}, and a ratio without the agent, the cap and the tree does not ship. Re-run to record them: \`BENCH_AGENTS=${a.agent} node run.mjs\`.`);
    continue;
  }
  const ratio = b.tokens / p.tokens;
  console.log(`${a.agent.padEnd(10)} solved bare ${b.solved}/${b.runs}, packed ${p.solved}/${p.runs}; ${ratio.toFixed(2)}x fewer tokens packed — ${where}.`);
  console.log(`${"".padEnd(10)} cost per solved task: bare ${cps(b)}, packed ${cps(p)}.`);
  // Levelling is a claim about the SOLVED rate closing, not about tokens. A
  // pairing where both arms already solve everything cannot show it, and saying
  // so is the result.
  if (b.runs && b.solved === b.runs && p.solved === p.runs) {
    console.log(`${"".padEnd(10)} both arms solved every run, so this pairing measures cost and not levelling: the defects are too easy to separate the arms.`);
  }
  for (const note of a.adapter_note) console.log(`${"".padEnd(10)} adapter: ${note}`);
}
console.log(`\ntotal spend on this matrix: $${summary.totals.spend_all.toFixed(2)}`);
