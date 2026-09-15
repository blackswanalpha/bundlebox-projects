#!/usr/bin/env node
// build.mjs — the storybook compiler.
//
//   inlet/<story>.json  +  patterns/*.md   ->   outlet/<story>/
//
// It writes one prompt per lane and one budget. Every token number in the
// budget is measured off a real tree by bundlebox's own estimator — the same
// code path `bb tokens estimate` uses — so the figure at the bottom of a prompt
// is a measurement of something that exists, not a number somebody typed.
//
// Two totals are reported and never added: what the build costs through the
// wire, and what the same build costs without it. The second is an ESTIMATE
// printed as a range, with all four of its terms named, because a single
// unwired number with no terms is a marketing claim.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STORY = process.argv[2] || "factory";
const BB = path.resolve(process.env.BB_HOME || path.join(HERE, "..", "..", "bundlebox"));

const story = JSON.parse(fs.readFileSync(path.join(HERE, "inlet", `${STORY}.json`), "utf8"));
// reference.root is written relative to the WORKSPACE, which is storybook's
// parent — not relative to this file and not to inlet/.
const REF = path.resolve(HERE, "..", story.reference.root);
if (!fs.existsSync(REF)) { console.error(`reference tree not found: ${REF}`); process.exit(2); }

// paths.js fixes ROOT at import, so the reference tree has to be named first.
process.env.BB_ROOT = REF;
const estimate = await import(pathToFileURL(path.join(BB, "src/tokens/estimate.js")).href);
const { load } = await import(pathToFileURL(path.join(BB, "src/core/config.js")).href);

const cfg = load();
const B = cfg.budget;

// ── the terms, each with where it came from ────────────────────────────────
const TERMS = {
  overhead_lean: { v: 29200, src: "MEASURED on the bundlebox reference workspace (README: opening window under the lean flag stack)" },
  overhead_full: { v: 44300, src: "MEASURED on the same workspace with no flag stack" },
  churn: { v: B.churn_factor, src: `config budget.churn_factor, refit by \`bb tokens calibrate\`` },
  widen: { v: B.anchor_widen, src: "config budget.anchor_widen: the fraction of the rest of an anchored file a unit is budgeted to also read" },
  window: { v: B.max_tokens, src: "config budget.max_tokens" },
  region: { v: 0.25, src: "ASSUMED: the share of a neighbour module that is actually the contract. Lower it and the wired total falls." },
  survey: { lo: 0.15, hi: 0.35, src: "ASSUMED range: the share of the reference tree a session opens to find what a packed brief would have handed it. This term is the whole thesis — an agent is billed for what it reads, and most of what it reads is orientation, not judgement." },
};

const tok = (p) => estimate.files([path.join(REF, p)]).total;
// The tree a session has to survey when nothing told it where to look. Measured,
// not assumed: it is the same walk `bb tokens estimate <dir>` does.
const TREE = tok(story.reference.scan || "src");
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const sessions = (total) => Math.max(1, Math.ceil(total / TERMS.window.v));

// ── the patterns ───────────────────────────────────────────────────────────
const patternDir = path.join(HERE, "patterns");
const patterns = fs.readdirSync(patternDir).filter((n) => /^\d+-.*\.md$/.test(n)).sort()
  .map((n) => ({ name: n, text: fs.readFileSync(path.join(patternDir, n), "utf8") }));
const patternText = patterns.map((p) => p.text.trim()).join("\n\n---\n\n");
const patternTokens = estimate.text(patternText, "prose");

// ── per lane ───────────────────────────────────────────────────────────────
function measure(lane) {
  const write = tok(lane.writes);
  const readFull = (lane.reads || []).reduce((a, p) => a + tok(p), 0);
  // Wired: the brief quotes the region and budgets a widening allowance over
  // the rest. Unwired: the whole neighbour, every time.
  const readWired = readFull * (TERMS.region.v + TERMS.widen.v * (1 - TERMS.region.v));
  return { write, readFull, readWired };
}

function lanePrompt(lane, m, brief) {
  return `# ${lane.id} · ${lane.title}

## The system this lane is part of

${story.thesis}

Falsified by: ${story.falsified_by}
Unit of work: ${story.unit}

## What this lane owes

${lane.owes}

## What it writes

\`${lane.writes}\` — measured at ${k(m.write)} tokens in the reference implementation at
\`${story.reference.root}\`. That is the size of the answer, not a target.

## What it must read, and only this

${(lane.reads || []).map((r) => `- \`${r}\` — ${k(tok(r))} tokens whole; this brief carries the contract region, budgeted at ${Math.round(TERMS.region.v * 100)}% plus a ${Math.round(TERMS.widen.v * 100)}% widening allowance over the rest`).join("\n")}

Everything this lane needs about those files is below or in the pattern pack.
Re-deriving it spends the budget this lane was given.

## Contracts it may not change

${story.contracts.map((c) => `- \`${c}\``).join("\n")}

## Acceptance

\`\`\`
${lane.acceptance}
\`\`\`

The exit code is the verdict. A unit with no passing gate is \`unproven\`, which
is a state, not a pass.

## Budget

| term | tokens | where it comes from |
|---|---|---|
| overhead | ${k(TERMS.overhead_lean.v)} | ${TERMS.overhead_lean.src} |
| brief | ${k(brief)} | this file, measured |
| read x churn | ${k(m.readWired * TERMS.churn.v)} | ${k(m.readWired)} of region at churn ${TERMS.churn.v} |
| write | ${k(m.write)} | the size of what this lane produces |
| **projected** | **${k(TERMS.overhead_lean.v + brief + m.readWired * TERMS.churn.v + m.write)}** | ESTIMATE |

---

${patternText}
`;
}

const lanes = story.lanes.map((lane) => {
  const m = measure(lane);
  // The brief has to be measured after it is written, and it contains its own
  // size. One pass at zero, one with the real number: the second differs from
  // the first by the digits of one figure, which is inside the estimator's error.
  const first = lanePrompt(lane, m, 0);
  const brief = estimate.text(first, "prose");
  const text = lanePrompt(lane, m, brief);
  const wired = TERMS.overhead_lean.v + brief + m.readWired * TERMS.churn.v + m.write;
  const orient = (lo) => TREE * (lo ? TERMS.survey.lo : TERMS.survey.hi);
  const unwiredAt = (lo) => {
    const body = orient(lo) + m.readFull * TERMS.churn.v + m.write;
    // Unpacked work does not fit one window, and every extra session pays the
    // full opening cost again.
    return TERMS.overhead_full.v * sessions(body + TERMS.overhead_full.v) + body;
  };
  return { ...lane, ...m, brief, text, wired, unwiredLo: unwiredAt(true), unwiredHi: unwiredAt(false),
    sessionsWired: sessions(wired), sessionsUnwiredLo: sessions(unwiredAt(true)), sessionsUnwiredHi: sessions(unwiredAt(false)) };
});

const sum = (f, rows = lanes) => rows.reduce((a, l) => a + f(l), 0);
const target = story.target_tokens || 0;
// The same four verdicts `bb compile` gives a unit, applied to a wave.
const verdictOf = (n) => (!target ? "—" : n <= target * 0.78 ? "FITS" : n <= target ? "TIGHT" : n <= target * 1.6 ? "SPLIT" : "HEAVY");
const waves = (story.waves || []).map((w) => {
  const rows = lanes.filter((l) => w.lanes.includes(l.id));
  const wired = sum((l) => l.wired, rows);
  return { ...w, rows, wired, lo: sum((l) => l.unwiredLo, rows), hi: sum((l) => l.unwiredHi, rows), verdict: verdictOf(wired) };
});
const total = { wired: sum((l) => l.wired), lo: sum((l) => l.unwiredLo), hi: sum((l) => l.unwiredHi),
  write: sum((l) => l.write), readFull: sum((l) => l.readFull), brief: sum((l) => l.brief),
  sessionsWired: sum((l) => l.sessionsWired), sessionsUnwiredLo: sum((l) => l.sessionsUnwiredLo), sessionsUnwiredHi: sum((l) => l.sessionsUnwiredHi) };

// ── the budget ─────────────────────────────────────────────────────────────
const row = (c) => `| ${c.join(" | ")} |`;
// Doctrine 7: a derived artefact is never edited by hand, and says so, so the
// detectors do not file hand-fix findings against it.
const STAMP = `<!-- Generated by storybook/build.mjs from inlet/${STORY}.json and patterns/. DO NOT EDIT. -->\n\n`;
const budget = `# ${story.title} — the budget

Every token figure here is measured by bundlebox's estimator over
\`${story.reference.root}\`, a real tree. ${story.reference.why}

## Waves, against the declared budget of ${k(target)}

${story.target_note || ""}

${row(["wave", "title", "lanes", "wired", "verdict"])}
${row(["---", "---", "---", "---", "---"])}
${waves.map((w) => row([String(w.n), w.title, w.lanes.join(" "), `**${k(w.wired)}**`, `**${w.verdict}**`])).join("\n")}
${row(["", "**whole programme**", String(lanes.length), `**${k(total.wired)}**`, verdictOf(total.wired)])}

A wave over budget is \`SPLIT\` — cut it, do not raise the number.

## Through the wire

${row(["lane", "writes", "brief", "read x churn", "projected", "sessions"])}
${row(["---", "---", "---", "---", "---", "---"])}
${lanes.map((l) => row([l.id, `\`${l.writes}\` ${k(l.write)}`, k(l.brief), k(l.readWired * TERMS.churn.v), `**${k(l.wired)}**`, String(l.sessionsWired)])).join("\n")}
${row(["**total**", `**${k(total.write)}**`, `**${k(total.brief)}**`, "", `**${k(total.wired)}**`, `**${total.sessionsWired}**`])}

\`projected = overhead + brief + payload x churn + reserve\`, with reserve here
being the size of what the lane writes. ESTIMATE.

## Without the wire

The same ten lanes, with nothing packing the brief first. Four terms, each named:

${row(["term", "wired", "unwired", "why it differs"])}
${row(["---", "---", "---", "---"])}
${row(["overhead per session", k(TERMS.overhead_lean.v), k(TERMS.overhead_full.v), "the lean flag stack. " + TERMS.overhead_lean.src])}
${row(["orientation, per session", "0 — the brief is the orientation", `${k(TREE * TERMS.survey.lo)} – ${k(TREE * TERMS.survey.hi)}`, `${Math.round(TERMS.survey.lo * 100)}–${Math.round(TERMS.survey.hi * 100)}% of a ${k(TREE)}-token tree, opened to find what the brief already said. ` + TERMS.survey.src])}
${row(["payload read", k(sum((l) => l.readWired)), k(total.readFull), `region plus a ${Math.round(TERMS.widen.v * 100)}% widening allowance, against whole files`])}
${row(["sessions", String(total.sessionsWired), `${total.sessionsUnwiredLo} – ${total.sessionsUnwiredHi}`, "unpacked work does not fit one window, and each extra session pays the opening cost again"])}

${row(["", "wired", "unwired (ESTIMATE, range)", "ratio"])}
${row(["---", "---", "---", "---"])}
${row(["**total**", `**${k(total.wired)}**`, `**${k(total.lo)} – ${k(total.hi)}**`, `**${(total.lo / total.wired).toFixed(1)}x – ${(total.hi / total.wired).toFixed(1)}x**`])}

## What is measured and what is not

- **MEASURED**: every \`writes\` and \`reads\` figure, by \`estimate.files\` over the real tree.
- **MEASURED**: the two overhead numbers, off bundlebox's own reference workspace.
- **CONFIG**: churn ${TERMS.churn.v}, widen ${TERMS.widen.v}, window ${k(TERMS.window.v)} — ${TERMS.churn.src}.
- **ASSUMED**: region ${TERMS.region.v} — ${TERMS.region.src}
- **MEASURED**: the reference tree at ${k(TREE)} tokens, by the same walk \`bb tokens estimate ${story.reference.scan || "src"}\` does.
- **ASSUMED**: survey ${TERMS.survey.lo}–${TERMS.survey.hi} — ${TERMS.survey.src}

The wired total is not added to the unwired one and neither is a bill. A bill is
what \`bb session\` prints after the run, off the transcript.

## The pattern pack

${patterns.map((p) => `- \`patterns/${p.name}\``).join("\n")}

Carried in every lane prompt: ${k(patternTokens)} tokens, byte-identical across
lanes, which is what lets the prompt cache treat it as one prefix rather than ${lanes.length}.
`;

// ── write ──────────────────────────────────────────────────────────────────
const outDir = path.join(HERE, "outlet", STORY);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "lanes"), { recursive: true });
for (const l of lanes) fs.writeFileSync(path.join(outDir, "lanes", `${l.id}.md`), STAMP + l.text);
fs.writeFileSync(path.join(outDir, "BUDGET.md"), STAMP + budget);
fs.writeFileSync(path.join(outDir, "PROMPT.md"), STAMP + `# ${story.title}

${story.thesis}

**Falsified by:** ${story.falsified_by}
**Unit of work:** ${story.unit}

## Surfaces

${story.surfaces.map((s) => `- **${s.id}** — ${s.why}`).join("\n")}

## Lanes

${lanes.map((l) => `- **${l.id}** ${l.title} — \`${l.writes}\`, projected ${k(l.wired)}`).join("\n")}

Each lane's own prompt is under \`lanes/\`. The budget, with its terms and what
each one is measured against, is in \`BUDGET.md\`.

## Gates

\`\`\`
quick: ${story.gates.quick}
full:  ${story.gates.full}
\`\`\`

---

${patternText}
`);
fs.writeFileSync(path.join(outDir, "budget.json"), JSON.stringify({
  story: story.id, measured_against: story.reference.root, terms: TERMS,
  lanes: lanes.map(({ text, ...l }) => l), total,
}, null, 2) + "\n");

console.log(`  ${lanes.length} lanes -> ${path.relative(process.cwd(), outDir)}`);
console.log(`  wired   ${k(total.wired)} tokens over ${total.sessionsWired} sessions   (ESTIMATE)`);
console.log(`  unwired ${k(total.lo)} - ${k(total.hi)} over ${total.sessionsUnwiredLo}-${total.sessionsUnwiredHi} sessions   (ESTIMATE, range)`);
console.log(`  ratio   ${(total.lo / total.wired).toFixed(1)}x - ${(total.hi / total.wired).toFixed(1)}x`);
for (const w of waves) console.log(`  wave ${w.n}  ${k(w.wired).padStart(7)}  ${w.verdict.padEnd(6)} ${w.title}`);
