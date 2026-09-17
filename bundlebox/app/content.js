// Every number and every line of copy on this page is quoted from the
// repository it describes — README.md and docs/index.html at v0.5.0 — so the
// page can be re-derived instead of re-argued. Nothing here is a projection.

export const RELEASE = "v0.5.0";
export const REPO = "https://github.com/blackswanalpha/bundlebox";
export const NPM = "https://www.npmjs.com/package/bundlebox";
export const DOCS = `${REPO}/blob/main/README.md`;
export const AGENT_DOCS = `${REPO}/blob/main/docs/agents.md`;

export const INSTALL = "npm i -g bundlebox";
export const INSTALL_ALT =
  "curl -fsSL https://raw.githubusercontent.com/blackswanalpha/bundlebox/main/scripts/install.sh | sh";

// `bb <verb> -> <noun>`: the shape the README uses to say what each verb turns
// into, and what it costs to find out.
export const VERBS = [
  ["genesis",  "a world",    "a doc becomes surfaces, rules and capabilities",        "0 tokens"],
  ["scan",     "findings",   "what is wrong, with evidence",                          "0 tokens"],
  ["fix",      "patches",    "local actuators close what they can",                   "0 tokens"],
  ["cookbook", "a board",    "what the RUNNING system does, run by the kernel",       "0 tokens"],
  ["simulate", "limits",     "what it does at a hundred callers",                     "0 tokens"],
  ["pinpoint", "a brief",    "where the work is, quoted and budgeted, before a model opens", "0 tokens"],
  ["arc",      "an index",   "every declaration in one file, read in microseconds",   "0 tokens"],
  ["compile",  "units",      "what to do about the rest, packed to one window",       ""],
  ["route",    "lanes",      "who does it, where, in what wave",                      ""],
  ["run",      "sessions",   "the only verb that spends",                             "spends"],
  ["finish",   "a ledger",   "what proves this done, declared first and run after",   "0 tokens"],
  ["sieve",    "a window",   "a tool result shrunk before it is billed twice",        "0 tokens"],
  ["runbook",  "the system", "is it up, is it ANSWERING, what broke since",           "0 tokens"],
  ["session",  "the bill",   "what a session used and saved, measured",               "0 tokens"],
];

// Measured on the reference workspace. Regenerate with `bb session`,
// `bb tokens profile --probe` and `bb buckmaster episodes`.
export const MEASURED = [
  {
    k: "opening window",
    was: "44.3k tokens",
    now: "29.2k",
    unit: "tokens",
    delta: "−34%",
    d: "What a spawned session carries before it has done any work.",
  },
  {
    k: "the same findings, planned",
    was: "5 sessions · 1.3M projected",
    now: "351k",
    unit: "tokens",
    delta: "−74%",
    d: "Two sessions instead of five, because the work was packed before it was routed.",
  },
  {
    k: "one pipeline tick",
    was: "226 agent turns",
    now: "133 s",
    unit: "0 model tokens",
    delta: "bb pipeline run intake",
    d: "The turns an agent would have spent, done by a parse on the box instead.",
  },
];

// `bb uptake` measured what sessions actually reached for over 15 sessions on
// the reference workspace. It is the finding that changed the wiring.
export const UPTAKE = [
  ["0 / 15", "sessions in which the MCP tools fired at all"],
  ["3 / 13", "sessions that used pinpoint, of those that opened five or more distinct files"],
  ["5 / 15", "sessions that read the reference tables, of those that ran a search"],
  ["30–598", "files opened per session by those thirteen sessions"],
];

export const PIPELINE = [
  ["01", "scan",    "Seventeen detectors over the tree. What is wrong, with the evidence attached.", "0 tokens"],
  ["02", "compile", "Findings become units, each packed to fit one agent window exactly once.",      "0 tokens"],
  ["03", "route",   "Units become lanes: who does it, in which worktree, in what wave.",             "0 tokens"],
  ["04", "run",     "The prompt and the command are written. --apply spawns the session.",           "spends"],
];

export const AGENTS = [
  ["Claude Code",    "CLAUDE.md",                      "6 hooks", ".claude/skills", ".mcp.json"],
  ["Codex CLI",      "AGENTS.md",                      "—",       ".codex/skills",  ".codex/config.toml"],
  ["Gemini CLI",     "GEMINI.md",                      "—",       "—",              ".gemini/settings.json"],
  ["Cursor",         ".cursor/rules/bundlebox.mdc",    "—",       "—",              ".cursor/mcp.json"],
  ["GitHub Copilot", ".github/copilot-instructions.md","—",       "—",              ".vscode/mcp.json"],
  ["OpenCode",       "AGENTS.md",                      "—",       "—",              "opencode.json"],
  ["Cline / Roo",    ".clinerules/bundlebox.md",       "—",       "—",              "—"],
  ["Windsurf",       ".windsurf/rules/bundlebox.md",   "—",       "—",              "—"],
  ["Aider",          ".aider.conf.yml → AGENTS.md",    "—",       "—",              "—"],
  ["any command",    "lanes.custom_command",           "—",       "—",              "—"],
];

export const ROUTES = [
  ["GET /",            "the page: what the factory saved, the window, the pipeline, every session"],
  ["GET /health",      "{ok, service, version} — the one route that answers without reading the store"],
  ["GET /api/state",   "everything the page renders, as JSON"],
  ["GET /api/bench",   "the last bb bench run: bare, packed, saved, per task"],
  ["GET /api/stream",  "server-sent events: the state, pushed when the store changes"],
];

// The performance profile under the hero. Every row is a pair the repository
// already measured, in one unit, so the bar is the number's share of its own
// row — not a score somebody assigned. `zero` marks a side that is genuinely
// nothing rather than something small, which is the whole claim.
export const PROFILE = [
  {
    axis: "Tokens saved",
    what: "The opening window a spawned session carries before any work",
    a: { label: "without", v: 44300, show: "44.3k" },
    b: { label: "bundlebox", v: 29200, show: "29.2k" },
    unit: "tokens",
    delta: "−34%",
  },
  {
    axis: "Session used",
    what: "What the same set of findings costs once it is packed and routed",
    a: { label: "without", v: 1300000, show: "1.3M" },
    b: { label: "bundlebox", v: 351000, show: "351k" },
    unit: "tokens",
    delta: "−74%",
  },
  {
    axis: "Sessions",
    what: "How many agent sessions the same work takes",
    a: { label: "without", v: 5, show: "5" },
    b: { label: "bundlebox", v: 2, show: "2" },
    unit: "sessions",
    delta: "−60%",
  },
  {
    axis: "Speed",
    what: "One pipeline tick — bb pipeline run intake — as agent turns",
    a: { label: "without", v: 226, show: "226" },
    b: { label: "bundlebox", v: 0, show: "0", zero: true },
    unit: "agent turns",
    delta: "133 s of local compute instead",
  },
  {
    axis: "Latency",
    what: "Building the brief on a task-shaped prompt, against its budget",
    a: { label: "budget", v: 15, show: "15" },
    b: { label: "measured", v: 0.47, show: "0.47" },
    unit: "seconds",
    delta: "32× inside",
  },
  {
    axis: "Reads",
    what: "Files a session opens to orient itself before it does anything",
    a: { label: "without", v: 598, show: "up to 598" },
    b: { label: "bundlebox", v: 1, show: "1 region" },
    unit: "files",
    delta: "the region, not the file",
  },
];
