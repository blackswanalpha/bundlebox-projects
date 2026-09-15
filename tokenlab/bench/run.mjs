#!/usr/bin/env node
// run.mjs — the lab. The same five tasks, in three trees, both arms each time.
//
// What this exists to answer: is the saving `bb bench` reports a property of
// bundlebox, or of the tree it was run in? The answer is "of the tree", and the
// number is only worth quoting with that curve next to it. A tool that reports
// 96% on a monorepo and quietly does not mention the 40% on a small service is
// quoting its best case as its behaviour.
//
// Nothing here calls a model. Both arms are token counts over files on disk,
// produced by `bb bench`, which is the same instrument the dashboard reads.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SCALES, ROOT, generate } from "./generate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "var", "lab.json");
const BB = process.env.BB || path.join(HERE, "..", "..", "..", "bundlebox", "bin", "bb.js");

// How many files the bare arm opens before it starts editing. This is the one
// assumption in the whole lab, so it is swept rather than picked: at 4 a
// session is disciplined, at 25 it is reading everything the search returned.
// The packed arm does not move with it, which is the shape worth seeing.
const CAPS = [4, 10, 25];

// The tasks, written once and run in every tree. They are phrased the way a
// person phrases one, because the bare arm's search is over the words in them.
const TASKS = [
  { id: "retry-cap", title: "the refund retry cap is wrong", problem: "refundBilling retries past RETRY_MAX and the ledger sees a duplicate" },
  { id: "settle-order", title: "settle order between ledger and payment", problem: "settleLedger writes before the payment side is captured" },
  { id: "void-state", title: "a voided invoice still reports pending", problem: "voidInvoice leaves INVOICE_STATES at pending after the write" },
  { id: "reconcile-id", title: "reconcile throws with no id", problem: "reconcileWallet throws no id instead of refusing the payout" },
  { id: "dispute-apply", title: "applying a dispute skips the tax side", problem: "applyDispute does not post the tax adjustment before resolving" },
];

// BB_ROOT, not just cwd. `bb` finds its workspace by walking UP for a
// `.bundlebox/config.json` or a `.git`, and a generated tree under
// `tokenlab/var/trees/` has neither until it is initialised — so the first call
// walked up and measured the parent workspace instead. Every measurement in
// this lab has to be of the tree it names.
function bb(cwd, args) {
  const r = spawnSync(process.execPath, [BB, ...args], {
    cwd, encoding: "utf8", timeout: 240000, env: { ...process.env, BB_ROOT: cwd },
  });
  return { rc: r.status ?? 1, out: r.stdout || "", err: r.stderr || "" };
}

function json(cwd, args) {
  const r = bb(cwd, args);
  try { return JSON.parse(r.out); } catch { return { _error: (r.err || r.out).split("\n").filter(Boolean).slice(-1)[0] || `rc ${r.rc}`, rc: r.rc }; }
}

function runTree(sc) {
  const cwd = path.join(ROOT, sc.id);
  // The tree needs the same preparation any workspace gets: the reference
  // tables exist or the packed arm has nothing to point at, and measuring
  // bundlebox against a workspace it was never run in is measuring the wrong
  // thing.
  bb(cwd, ["init", "--apply", "--quiet"]);
  bb(cwd, ["snapgen", "build", "--quiet"]);
  fs.mkdirSync(path.join(cwd, ".bundlebox", "bench"), { recursive: true });
  fs.writeFileSync(path.join(cwd, ".bundlebox", "bench", "lab.json"),
    JSON.stringify({ title: `tokenlab ${sc.id} — ${sc.files} files`, note: "the same five tasks in every tree", tasks: TASKS }, null, 2));
  const runs = [];
  for (const cap of CAPS) {
    const r = json(cwd, ["bench", "run", "lab", "--cap", String(cap), "--json"]);
    if (r._error) return { scale: sc.id, files: sc.files, note: sc.note, error: r._error };
    const t = r.totals || {};
    runs.push({ cap, bare: t.bare, packed: t.packed, saved: t.saved, saved_pct: t.saved_pct, ratio: t.ratio, losses: t.losses,
      // How many files the search returned before the cap was applied. This is
      // the number that actually grows with the tree, and it is what a bare
      // session has to triage by hand.
      found: Math.max(0, ...(r.tasks || []).map((x) => x.bare_files_found || 0)) });
  }
  const mid = runs.find((x) => x.cap === 10) || runs[0];
  const last = json(cwd, ["bench", "show", "--json"]);
  return {
    scale: sc.id, files: sc.files, note: sc.note, caps: runs,
    bare: mid.bare, packed: mid.packed, saved: mid.saved, saved_pct: mid.saved_pct, ratio: mid.ratio,
    losses: runs.reduce((a, x) => a + (x.losses || 0), 0), found: mid.found,
    tasks: (last.tasks || []).map((x) => ({ id: x.id, bare: x.bare, packed: x.packed, saved_pct: x.saved_pct, error: x.error || "" })),
  };
}

const fmt = (n) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function render(h, body) {
  const w = h.map((_, i) => Math.max(h[i].length, ...body.map((b) => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join("  ").trimEnd();
  return [line(h), w.map((n) => "-".repeat(n)).join("  "), ...body.map(line)].join("\n");
}

function table(rows) {
  const body = rows.flatMap((r) => r.error
    ? [[r.scale, String(r.files), "—", "—", "—", "—", r.error.slice(0, 30), ""]]
    : r.caps.map((c, i) => [i === 0 ? r.scale : "", i === 0 ? String(r.files) : "",
        String(c.found), String(c.cap), fmt(c.bare), fmt(c.packed), `${c.saved_pct}%`, c.ratio ? `${c.ratio}x` : ""]));
  return render(["tree", "files", "hits", "read", "bare", "packed", "share", "ratio"], body);
}

const force = process.argv.includes("--force");
generate({ force });
const rows = SCALES.map(runTree);
const ok = rows.filter((r) => !r.error);
const result = {
  at: new Date().toISOString(),
  kind: "MEASURED",
  method: "bb bench, both arms, over generated trees of known size. No model was called.",
  tasks: TASKS.length,
  scales: rows,
  caps: CAPS,
  spread: ok.length >= 2
    ? { low: Math.min(...ok.flatMap((r) => r.caps.map((c) => c.saved_pct))),
        high: Math.max(...ok.flatMap((r) => r.caps.map((c) => c.saved_pct))),
        why: "the same five tasks across three trees and three read budgets. The packed arm is flat; everything that moves is the bare arm." }
    : null,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

console.log(`\n  tokenlab — ${TASKS.length} tasks in ${rows.length} trees, both arms, 0 model tokens\n`);
console.log(table(rows).split("\n").map((l) => `  ${l}`).join("\n"));
if (result.spread) {
  const packed = ok.flatMap((r) => r.caps.map((c) => c.packed));
  console.log(`\n  ${result.spread.low}% to ${result.spread.high}% for the same five tasks.`);
  console.log(`  hits   what the search returned: ${Math.min(...ok.map((r) => r.found))} to ${Math.max(...ok.map((r) => r.found))} files as the tree grows 12 -> 400.`);
  console.log(`  read   how many of them a bare session opens. This is the assumption, so it is swept: ${CAPS.join(", ")}.`);
  console.log(`  packed ${fmt(Math.min(...packed))} to ${fmt(Math.max(...packed))} tokens across every row — it does not move with either.`);
  console.log("");
  console.log("  That is the finding, and it is not the headline percentage: the packed arm is CONSTANT.");
  console.log("  A pinpoint prompt costs what the task costs, whatever the repository around it does; the");
  console.log("  bare arm pays for the repository. Quote the curve, not the best row.");
}
const lost = ok.reduce((a, r) => a + (r.losses || 0), 0);
console.log(lost ? `\n  ${lost} task(s) cost more packed than bare and are in var/lab.json.` : "\n  No task cost more packed than bare.");
console.log(`  ${path.relative(process.cwd(), OUT)}\n`);
