// monitor.mjs — a wallboard built once from what bundlebox already recorded,
// not a client that goes and asks.
//
// Two decisions worth naming.
//
// Every artefact is read from disk, and `/stats` is called through the same
// `handle()` the surface tests use rather than over a socket — the output is
// one HTML file with nothing left to fetch, so opening it needs no server, no
// CDN font, and no network at all.
//
// A missing artefact is rendered, not skipped: a scan that has not run yet or
// a corpus with no board on file is the kind of gap this page exists to show,
// so it gets the same "empty" panel console.css already defines rather than a
// blank space that reads as a bug.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "monitor", "index.html");

const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
};

function newestBoard() {
  const dir = path.join(ROOT, ".bundlebox", "var", "boards");
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".json")); }
  catch { return null; }
  if (!names.length) return null;
  // Names carry a sortable ISO timestamp, so the lexical max is the newest run.
  names.sort();
  return readJSON(path.join(dir, names[names.length - 1]));
}

async function liveStats() {
  try {
    const { handle } = await import(path.join(ROOT, "src", "server.js"));
    const r = await handle("GET", "/stats");
    return r.status === 200 ? r.body : null;
  } catch {
    return null;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

const stat = (term, value) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`;
const empty = (headline, note) => `<div class="empty"><p class="headline">${esc(headline)}</p><p>${esc(note)}</p></div>`;

function renderScan(scan) {
  if (!scan) return empty("No scan on file.", "Run bb oversight scan to fill this panel.");
  const figures = [
    stat("open", scan.open),
    stat("new", scan.new),
    stat("resolved", scan.resolved),
    stat("promotable", scan.promotable),
    stat("checks", scan.ran?.length ?? 0),
    stat("scan time", `${scan.ms}ms`),
  ].join("");
  const rows = (scan.ran ?? []).map((c) => `<li>
      <span class="name">${esc(c.name)}</span>
      <span class="holder">${c.count} finding${c.count === 1 ? "" : "s"}</span>
      <span class="handoff">${c.error ? esc(c.error) : `${c.ms}ms`}</span>
    </li>`).join("");
  return `<dl class="figures">${figures}</dl><ul class="rota">${rows}</ul>
    <p class="queue-foot">as of ${esc(scan.at)}</p>`;
}

function renderBoard(board) {
  if (!board) return empty("No corpus run on file.", "Run the sampletwo corpus to fill this panel.");
  const t = board.totals ?? {};
  const figures = [
    stat("passed", t.passed ?? 0),
    stat("failed", t.failed ?? 0),
    stat("error", t.error ?? 0),
    stat("blocked", t.blocked ?? 0),
    stat("requests", board.requests ?? 0),
    stat("run time", `${board.seconds ?? 0}s`),
  ].join("");
  const rows = (board.scenarios ?? []).map((s) => {
    const passed = s.state === "passed";
    return `<li class="row">
      <span class="spine"></span>
      <span class="row-summary">${esc(s.title)}</span>
      <span class="row-age">${s.seconds}s</span>
      <span class="row-meta">
        <span class="key">${esc(s.surface)}</span>
        <span class="badge">${esc(s.severity)}</span>
        <span class="state ${passed ? "state-resolved" : "state-triggered"}">${esc(s.state)}</span>
      </span>
    </li>`;
  }).join("");
  return `<dl class="figures">${figures}</dl>
    <ol class="rows">${rows}</ol>
    <p class="queue-foot">${esc(board.corpus)} against ${esc(board.base)} · ${esc(board.at)}</p>`;
}

function renderRunbook(runbook) {
  if (!runbook || !runbook.services?.length) return empty("No runbook on file.", "Nothing in .bundlebox/runbook describes a service yet.");
  const rows = runbook.services.map((s) => `<li>
      <span class="name">${esc(s.id)}</span>
      <span class="holder">${esc(s.group)} · :${esc(s.port)}</span>
      <span class="handoff">${esc(s.cmd)}</span>
    </li>`).join("");
  return `<ul class="rota">${rows}</ul>`;
}

function renderStats(stats) {
  if (!stats) return empty("Stats are not available.", "GET /stats could not be reached; the store may be unseeded.");
  const figures = [
    stat("open", stats.open),
    stat("unanswered", stats.triggered ? `${stats.triggered} · ${duration(stats.unacknowledged_oldest_s * 1000)}` : "none"),
    stat("mtta", stats.mtta_s === null ? "—" : duration(stats.mtta_s * 1000)),
    stat("mttr", stats.mttr_s === null ? "—" : duration(stats.mttr_s * 1000)),
    stat("pages", stats.pages),
  ].join("");
  return `<dl class="figures">${figures}</dl>`;
}

function page({ scan, board, runbook, stats, generatedAt }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relay — monitor</title>
<meta name="description" content="A wallboard built from what bundlebox already recorded: the last scan, the last corpus run, the runbook, and the live stats.">
<link rel="stylesheet" href="../web/console.css">
<style>
  .monitor { display: grid; gap: var(--s4); max-width: 1100px; margin: 0 auto; padding: var(--s4); }
  .panel { background: var(--raised); border: 1px solid var(--rule); border-radius: var(--r-panel); padding: var(--s3) var(--s4); box-shadow: var(--z-raised); }
  .panel h2 { font-family: var(--font-text); font-size: var(--f-micro); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 var(--s2); }
</style>
</head>
<body>
<header class="masthead">
  <a class="wordmark" href="/">Relay<span class="wordmark-dot"></span></a>
  <p class="standfirst">Monitor — built from bundlebox artefacts, generated ${esc(generatedAt)}.</p>
</header>
<main class="monitor">
  <section class="panel"><h2>Scan</h2>${renderScan(scan)}</section>
  <section class="panel"><h2>Corpus</h2>${renderBoard(board)}</section>
  <section class="panel"><h2>Runbook</h2>${renderRunbook(runbook)}</section>
  <section class="panel"><h2>Live stats</h2>${renderStats(stats)}</section>
</main>
</body>
</html>
`;
}

async function main() {
  const scan = readJSON(path.join(ROOT, ".bundlebox", "var", "scan.json"));
  const board = newestBoard();
  const runbook = readJSON(path.join(ROOT, ".bundlebox", "runbook", "services.json"));
  const stats = await liveStats();
  const html = page({ scan, board, runbook, stats, generatedAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  process.stdout.write(`wrote ${path.relative(ROOT, OUT)}\n`);
}

main();
