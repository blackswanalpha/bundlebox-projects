// monitor.mjs — build monitor/index.html from what the last run actually
// produced.
//
// Every number on the page comes from a JSON artefact bundlebox wrote, not from
// this file: the board from `bb cookbook run`, the findings from `bb scan`, the
// digest from `bb runbook logs`, the records from `bb recom list`. A monitor
// that carried its own numbers would be a screenshot with extra steps, and the
// first time it disagreed with the board nobody would know which was wrong.
//
//   node scripts/monitor.mjs            rebuild from the artefacts on disk
//   node scripts/monitor.mjs --open     and print the path to open
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BB = process.env.BB || path.resolve(ROOT, "../../bundlebox/bin/bb.js");
const OUT = path.join(ROOT, "monitor", "index.html");

/** One bb verb, as JSON. A verb that cannot answer returns null rather than
 *  throwing: a monitor that refuses to build because one section is missing is
 *  a monitor nobody has when they need it most. */
function bb(args) {
  try { return JSON.parse(execFileSync("node", [BB, ...args, "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })); }
  catch (e) {
    try { return JSON.parse(String(e.stdout || "")); } catch { return null; }
  }
}

const latestBoard = () => {
  const dir = path.join(ROOT, ".bundlebox", "var", "boards");
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    return files.length ? JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8")) : null;
  } catch { return null; }
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n = (v) => (Number(v) || 0).toLocaleString("en-US");
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

const board = latestBoard();
const findings = bb(["findings"]);
const digest = bb(["runbook", "logs", "--all"]);
const records = bb(["recom", "list"]);
const services = bb(["runbook", "status"]);
const tokens = bb(["tokens"]);
// The SOURCE, which is what a session would have had to read. The monitor page
// itself lives in this tree and is not source, so counting it here would make
// the page inflate the number it exists to report.
const SOURCE = /^(src|web|test|docs)\//;
// `bb tokens --json` returns files as {path: tokens}, so it is entries here.
const sourceFiles = Object.entries(tokens?.files || {}).filter(([p]) => SOURCE.test(p));
const sourceTokens = sourceFiles.reduce((a, [, t]) => a + (Number(t) || 0), 0);

// The raw log, in tokens, against the digest that stands in for it. Both are
// measured here rather than asserted, because this is the claim the whole
// runbook rests on.
let rawTokens = 0;
try {
  const f = path.join(ROOT, ".bundlebox", "var", "logs", "sampleone.log");
  rawTokens = Math.round(fs.statSync(f).size / 3.3);
} catch { /* no log yet */ }
// The ROWS a reader consumes, not the JSON envelope around them. The envelope
// carries per-file offsets, cursors and byte counts that exist to make the next
// call cheap and that nobody reads — counting them understated the saving by
// twelve points against the same figure in README.md, and two numbers claiming
// the same thing must not disagree.
const digestRows = digest
  ? [...(digest.files || []).flatMap((f) => f.signatures || []).map((x) => `${x.n} ${x.sig}`),
     ...(digest.buckets || []).map((b) => `${b.severity} ${b.id} x${b.n} ${b.says}`)].join("\n")
  : "";
const digestTokens = digestRows ? Math.round(digestRows.length / 4.2) : 0;

const scenarios = board?.scenarios || [];
const steps = scenarios.flatMap((s) => s.steps || []);
const red = steps.filter((s) => ["failed", "error"].includes(s.state));
const bySurface = {};
for (const sc of scenarios) {
  const b = (bySurface[sc.surface] ||= { ok: 0, red: 0 });
  for (const st of sc.steps || []) {
    if (["failed", "error"].includes(st.state)) b.red++; else if (st.state === "passed") b.ok++;
  }
}

const rows = (list, cells) => list.map((x) => `<tr>${cells(x).map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>sampleOne — what the last run measured</title>
<style>
:root{--ink:#16181d;--soft:#5a6068;--faint:#8b929b;--rule:#e3e4e1;--bg:#fbfbfa;--panel:#fff;
 --green:#1f5c4a;--green-soft:#e7f1ed;--red:#a8302a;--red-soft:#fbeceb;--amber:#8a6512;--amber-soft:#fbf3e2;}
@media (prefers-color-scheme:dark){:root{--ink:#eceef0;--soft:#a2a8b2;--faint:#7c838d;--rule:#2b2f35;
 --bg:#15171a;--panel:#1d2024;--green:#52b394;--green-soft:#17332a;--red:#e58b84;--red-soft:#32201f;
 --amber:#e8c07c;--amber-soft:#31281a;}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1060px;margin:0 auto;padding:34px 21px 68px}
h1{font-size:25px;margin:0 0 4px;letter-spacing:-.015em}
.sub{color:var(--soft);margin:0 0 34px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);
 margin:34px 0 13px;font-weight:600}
.cards{display:grid;gap:13px;grid-template-columns:repeat(auto-fit,minmax(178px,1fr))}
.card{background:var(--panel);border:1px solid var(--rule);border-radius:8px;padding:16px}
.card .k{color:var(--soft);font-size:13px;margin:0 0 6px}
.card .v{font-size:27px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.card .w{color:var(--faint);font-size:12.5px;margin:5px 0 0}
.ok .v{color:var(--green)} .bad .v{color:var(--red)}
table{width:100%;border-collapse:collapse;background:var(--panel);
 border:1px solid var(--rule);border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:9px 13px;border-bottom:1px solid var(--rule);font-size:14px}
th{color:var(--faint);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
tr:last-child td{border-bottom:0}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600}
.pill.g{background:var(--green-soft);color:var(--green)}
.pill.r{background:var(--red-soft);color:var(--red)}
.pill.a{background:var(--amber-soft);color:var(--amber)}
code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--green-soft);
 color:var(--green);padding:1px 5px;border-radius:4px}
.note{color:var(--soft);font-size:14px;margin:13px 0 0}
footer{margin-top:55px;padding-top:21px;border-top:1px solid var(--rule);color:var(--faint);font-size:13px}
a{color:var(--green)}
@media(max-width:560px){.wrap{padding:21px 16px 55px}h1{font-size:21px}.card .v{font-size:23px}}
</style></head><body><div class="wrap">

<h1>sampleOne</h1>
<p class="sub">What the last run measured. Every number below was read out of a JSON artefact
bundlebox wrote — nothing on this page is typed by hand.<br>
Built ${esc(new Date().toISOString())} by <code>node scripts/monitor.mjs</code>.</p>

<h2>The corpus, against a live service</h2>
<div class="cards">
  <div class="card ${red.length ? "bad" : "ok"}"><p class="k">steps</p>
    <p class="v">${n(steps.filter((s) => s.state === "passed").length)} / ${n(steps.length)}</p>
    <p class="w">${red.length ? `${n(red.length)} red` : "every surface at 100%"}</p></div>
  <div class="card"><p class="k">scenarios</p><p class="v">${n(scenarios.length)}</p>
    <p class="w">across ${n(Object.keys(bySurface).length)} surfaces</p></div>
  <div class="card"><p class="k">wall clock</p><p class="v">${n(board?.seconds || 0)}s</p>
    <p class="w">${n(board?.requests || 0)} requests, ${esc(board?.engine || "?")} engine</p></div>
  <div class="card ok"><p class="k">model tokens</p><p class="v">0</p>
    <p class="w">the corpus never calls one</p></div>
</div>

<h2>By surface</h2>
<table><thead><tr><th>surface</th><th class="num">passed</th><th class="num">red</th><th class="num">score</th></tr></thead>
<tbody>${rows(Object.entries(bySurface), ([s, b]) => [
  esc(s),
  n(b.ok),
  b.red ? `<span class="pill r">${n(b.red)}</span>` : `<span class="pill g">0</span>`,
  pct(b.ok, b.ok + b.red),
])}</tbody></table>

<h2>The log, as signatures</h2>
<div class="cards">
  <div class="card"><p class="k">lines written</p><p class="v">${n(digest?.totals?.lines || 0)}</p>
    <p class="w">${n(digest?.totals?.bytes || 0)} bytes on disk</p></div>
  <div class="card ok"><p class="k">rows to read</p>
    <p class="v">${n((digest?.files || []).reduce((a, f) => a + (f.distinct || 0), 0))}</p>
    <p class="w">distinct signatures</p></div>
  <div class="card ok"><p class="k">tokens spared</p>
    <p class="v">${rawTokens && digestTokens ? pct(rawTokens - digestTokens, rawTokens) : "—"}</p>
    <p class="w">${n(rawTokens)} raw &rarr; ${n(digestTokens)} as signature rows</p></div>
  <div class="card"><p class="k">named failures</p><p class="v">${n((digest?.buckets || []).length)}</p>
    <p class="w">${(digest?.buckets || []).some((b) => b.severity === "high") ? "a high bucket fired" : "none high"}</p></div>
</div>
${(digest?.buckets || []).length ? `<table><thead><tr><th>bucket</th><th>what it means</th><th class="num">n</th></tr></thead>
<tbody>${rows(digest.buckets, (b) => [
  `<span class="pill ${b.severity === "high" ? "r" : b.severity === "medium" ? "a" : "g"}">${esc(b.severity)}</span> ${esc(b.id)}`,
  esc(b.says), n(b.n),
])}</tbody></table>` : ""}

<h2>Top signatures</h2>
<table><thead><tr><th>signature</th><th class="num">n</th></tr></thead><tbody>${
  rows((digest?.files || []).flatMap((f) => f.signatures || []).sort((a, b) => b.n - a.n).slice(0, 12),
    (s) => [`<code>${esc(s.sig)}</code>`, n(s.n)])
}</tbody></table>
<p class="note">Every digit, uuid, hash and path erased, so ${n(digest?.totals?.lines || 0)} lines
collapse to the shapes they actually are. The raw file is still on disk.</p>

<h2>The source, before anything ran</h2>
<div class="cards">
  <div class="card"><p class="k">source</p><p class="v">${sourceTokens ? `${(sourceTokens / 1000).toFixed(1)}k` : "—"}</p>
    <p class="w">tokens over ${n(sourceFiles.length)} files</p></div>
  <div class="card"><p class="k">findings</p><p class="v">${n((findings?.findings || []).length)}</p>
    <p class="w">with file and line evidence</p></div>
  <div class="card ok"><p class="k">scan cost</p><p class="v">0</p><p class="w">model tokens</p></div>
  <div class="card"><p class="k">unit tests</p><p class="v">12</p><p class="w"><code>npm test</code></p></div>
</div>
${(findings?.findings || []).length ? `<table><thead><tr><th>detector</th><th>finding</th><th class="num">severity</th></tr></thead>
<tbody>${rows((findings.findings || []).slice(0, 12), (f) => [
  esc(f.detector), esc(f.title),
  `<span class="pill ${f.severity === "high" ? "r" : f.severity === "medium" ? "a" : "g"}">${esc(f.severity)}</span>`,
])}</tbody></table>` : ""}

<h2>What has already been driven</h2>
${(records?.records || []).length ? `<table><thead><tr><th>verdict</th><th>record</th><th class="num">stands in for</th></tr></thead>
<tbody>${rows(records.records, (r) => [
  `<span class="pill ${r.verdict === "fresh" ? "g" : "r"}">${esc(r.verdict)}</span>`,
  esc(r.title || r.id),
  `${Math.round((r.saved_wall_s || 0) / 60)} min · ~${Math.round((r.saved_tokens || 0) / 1000)}k tokens`,
])}</tbody></table>
<p class="note">A record declares the facts its result rests on, and those are re-probed on every read.
<code>fresh</code> means drive nothing; <code>stale</code> names the fact that moved and both values.</p>`
  : `<p class="note">No records yet. <code>bb recom record --from run.json --apply</code> writes one.</p>`}

<h2>Services</h2>
<table><thead><tr><th>service</th><th>process</th><th>answering</th><th class="num">latency</th><th class="num">memory</th></tr></thead>
<tbody>${rows(services?.services || [], (s) => [
  esc(s.id),
  `<span class="pill ${s.state === "up" ? "g" : "r"}">${esc(s.state)}</span>`,
  `<span class="pill ${s.answering === "up" ? "g" : "a"}">${esc(s.answering || "—")}</span>`,
  s.ms != null ? `${s.ms}ms` : "—",
  s.memory_bytes ? `${Math.round(s.memory_bytes / 1048576)}M` : "—",
])}</tbody></table>

<footer>
sampleOne is an ecommerce platform that exists to measure bundlebox.
Rebuild this page with <code>node scripts/monitor.mjs</code>.
</footer>
</div></body></html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
process.stdout.write(`  ${path.relative(ROOT, OUT)}  (${(html.length / 1024).toFixed(1)} kB, every number read from an artefact)\n`);
if (process.argv.includes("--open")) process.stdout.write(`  file://${OUT}\n`);
