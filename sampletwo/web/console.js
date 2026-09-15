// console.js — the screen, and nothing the service does not already know.
//
// Two decisions worth naming.
//
// An action you may not take is drawn, focusable, and says why when you press
// it. Hiding it would leave a responder wondering whether the button exists;
// disabling it silently would leave them pressing a dead control at 03:00.
//
// Age is computed from the instant the SERVER reported, never from the
// browser's clock. Relay runs on a clock that only moves when somebody moves
// it, and a console counting up on its own would show an age the service
// disagrees with.
const $ = (sel) => document.querySelector(sel);
const api = (path) => `${location.origin}${path}`;

const state = {
  me: null, token: null, directory: [], rotations: [], onCallBy: new Map(),
  incidents: [], stats: null, selected: null, filter: "open", now: 0,
  loading: true, error: null,
};

const PLURAL = { triggered: "triggered", acknowledged: "acknowledged", resolved: "resolved" };
const FILTERS = [["open", "Open"], ["triggered", "Triggered"], ["acknowledged", "Taken"], ["resolved", "Closed"], ["all", "All"]];

const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) node.append(k);
  return node;
};
const icon = (id) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ico");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
};

function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const clockTime = (ms) => new Date(ms).toISOString().slice(11, 16);
const dayTime = (ms) => new Date(ms).toISOString().slice(5, 16).replace("T", " ");

async function call(path, opts = {}) {
  const headers = { "content-type": "application/json" };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const res = await fetch(api(path), { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `${res.status}`), { status: res.status, body });
  return body;
}

function toast(message, bad = false) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.toggle("bad", bad);
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 4200);
}

/* ── loading ──────────────────────────────────────────────────────────── */

async function load() {
  try {
    const [board, stats, oncall] = await Promise.all([call("/incidents?limit=100"), call("/stats"), call("/oncall")]);
    state.incidents = board.items;
    state.now = board.now_ms;
    state.stats = stats;
    state.rotations = oncall.rotations;
    state.directory = oncall.directory;
    state.onCallBy = new Map();
    for (const r of oncall.rotations) for (const key of r.services) state.onCallBy.set(key, r.on_call);
    state.error = null;
  } catch (e) {
    state.error = e.status ? `${e.message} (${e.status})` : "Relay is not answering on this address.";
  } finally {
    state.loading = false;
    render();
  }
}

async function signIn(email) {
  if (!email) { state.me = null; state.token = null; localStorage.removeItem("relay.email"); return load(); }
  try {
    const who = await call("/auth/token", { method: "POST", body: { email } });
    state.token = who.token;
    state.me = who;
    localStorage.setItem("relay.email", email);
  } catch (e) {
    toast(e.message, true);
  }
  return load();
}

/* ── permission, mirrored from the service so the screen agrees with it ── */

function refusal(incident) {
  if (!state.me) return "Sign in to answer a page.";
  if (state.me.role === "commander") return null;
  if (incident.assignee_id === state.me.responder_id) return null;
  if (state.onCallBy.get(incident.service) === state.me.handle) return null;
  return `${incident.key} is assigned to ${incident.assignee ?? "nobody"}, and you are not on call for ${incident.service}.`;
}

/* ── render ───────────────────────────────────────────────────────────── */

function render() {
  renderClock();
  renderShift();
  renderFilters();
  renderQueue();
  renderDetail();
}

/* The toggle writes the choice onto the root element and the stylesheet gives
   that attribute priority over the system preference, in both directions. A
   choice already on the element — a wallboard pinned to dark by whoever hung
   it — is read, never cleared. */
function theme(next = null) {
  const root = document.documentElement;
  const stored = localStorage.getItem("relay.theme");
  if (next) { root.dataset.theme = next; localStorage.setItem("relay.theme", next); }
  else if (stored) root.dataset.theme = stored;
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  $("#theme").setAttribute("aria-label", dark ? "Switch to the light console" : "Switch to the dark console");
  return dark;
}

function renderClock() {
  $("#clock-time").textContent = state.now ? `${dayTime(state.now)}Z` : "—";
  $("#clock-kind").textContent = state.me?.role === "commander" ? "clock · advance" : "clock";
  const holder = $("#clock");
  holder.classList.toggle("is-commander", state.me?.role === "commander");
  if (state.me?.role === "commander" && !holder.querySelector(".control")) {
    const jump = el("select", { className: "control", id: "advance", title: "Move the service clock forward" });
    jump.append(el("option", { value: "", textContent: "advance…" }));
    for (const m of [1, 5, 15, 60, 480]) jump.append(el("option", { value: String(m), textContent: `+${m < 60 ? `${m}m` : `${m / 60}h`}` }));
    jump.addEventListener("change", async () => {
      if (!jump.value) return;
      const r = await call("/admin/clock", { method: "POST", body: { advance_minutes: Number(jump.value) } });
      jump.value = "";
      toast(r.fired.length ? `${r.fired.length} escalation${r.fired.length === 1 ? "" : "s"} fired` : "Nothing was due.");
      load();
    });
    holder.append(jump);
  } else if (state.me?.role !== "commander") {
    holder.querySelector(".control")?.remove();
  }
}

function renderShift() {
  const rota = $("#rota");
  rota.replaceChildren();
  for (const r of state.rotations) {
    rota.append(el("li", {}, [
      icon("i-handoff"),
      el("span", { className: "name", textContent: `${r.name}` }),
      el("span", { className: "holder", textContent: r.on_call ?? "nobody" }),
      el("span", { className: "handoff", textContent: r.handoff_in_s > 0 ? `hands over in ${duration(r.handoff_in_s * 1000)}` : "handing over" }),
    ]));
  }

  const s = state.stats;
  const figures = $("#figures");
  figures.replaceChildren();
  const rows = s ? [
    ["open", String(s.open)],
    ["unanswered", s.triggered ? `${s.triggered} · ${duration(s.unacknowledged_oldest_s * 1000)}` : "none"],
    ["mtta", s.mtta_s === null ? "—" : duration(s.mtta_s * 1000)],
    ["mttr", s.mttr_s === null ? "—" : duration(s.mttr_s * 1000)],
    ["pages", String(s.pages)],
  ] : [];
  for (const [term, value] of rows) figures.append(el("div", {}, [el("dt", { textContent: term }), el("dd", { textContent: value })]));
}

function renderFilters() {
  const bar = $("#filters");
  if (bar.childElementCount) {
    for (const b of bar.children) b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter));
    return;
  }
  for (const [key, label] of FILTERS) {
    const b = el("button", { type: "button", textContent: label });
    b.dataset.filter = key;
    b.setAttribute("aria-pressed", String(key === state.filter));
    b.addEventListener("click", () => { state.filter = key; render(); });
    bar.append(b);
  }
}

const visible = () => state.incidents.filter((i) =>
  state.filter === "all" ? true : state.filter === "open" ? i.state !== "resolved" : i.state === state.filter);

function renderQueue() {
  const list = $("#rows");
  list.replaceChildren();

  if (state.loading) {
    list.append(el("li", {}, el("div", { className: "skeleton" }, [el("span"), el("span"), el("span")])));
    return;
  }
  if (state.error) {
    list.append(el("li", {}, el("div", { className: "error" }, [
      el("p", { className: "headline", textContent: "The board is not loading." }),
      el("p", { textContent: state.error }),
      el("button", { className: "btn", type: "button", textContent: "Try again", onclick: load }),
    ])));
    return;
  }
  const items = visible();
  if (!items.length) {
    list.append(el("li", {}, el("div", { className: "empty" }, [
      el("p", { className: "headline", textContent: "Nothing is paging." }),
      el("p", { textContent: state.filter === "open" ? "Every incident on the board is closed." : `No incident is ${PLURAL[state.filter] ?? "here"}.` }),
    ])));
    return;
  }

  for (const i of items) {
    const row = el("button", { className: `row ${i.severity}`, type: "button" });
    row.setAttribute("aria-current", String(i.key === state.selected));
    row.setAttribute("aria-label", `${i.key}, ${i.severity}, ${i.summary}`);
    row.append(
      el("span", { className: "spine" }),
      el("span", { className: "row-summary", textContent: i.summary }),
      el("span", { className: "row-age", textContent: duration((i.resolved_ms ?? state.now) - i.opened_ms) }),
      el("span", { className: "row-meta" }, [
        el("span", { className: "key", textContent: i.key }),
        el("span", { className: "badge", textContent: i.severity }),
        el("span", { className: `state state-${i.state}`, textContent: i.state }),
        el("span", { textContent: i.service }),
        el("span", { textContent: i.assignee ? `with ${i.assignee}` : "unassigned" }),
        i.alert_count > 1 ? el("span", { textContent: `${i.alert_count} alerts` }) : "",
      ]),
    );
    row.addEventListener("click", () => select(i.key));
    list.append(el("li", {}, row));
  }
  $("#queue-foot").textContent = `${items.length} of ${state.incidents.length} · ${state.stats?.pages ?? 0} pages sent`;
}

async function select(key) {
  state.selected = key;
  renderQueue();
  try {
    const full = await call(`/incidents/${key}`);
    const pages = await call(`/notifications?incident=${key}`);
    state.detail = { ...full, pages: pages.items };
  } catch (e) {
    state.detail = null;
    toast(e.message, true);
  }
  renderDetail();
}

function action(label, iconId, { primary = false, why = null, run }) {
  const b = el("button", { className: `btn${primary ? " btn-primary" : ""}`, type: "button" }, [icon(iconId), el("span", { textContent: label })]);
  if (why) {
    b.setAttribute("aria-disabled", "true");
    b.title = why;
    b.addEventListener("click", () => toast(why, true));
  } else {
    b.addEventListener("click", run);
  }
  return b;
}

function detailHead(i) {
  return el("div", { className: `detail-head ${i.severity}` }, [
    el("p", { className: "detail-key" }, [
      el("span", { textContent: i.key }),
      el("span", { className: "badge", textContent: i.severity }),
      el("span", { className: `state state-${i.state}`, textContent: i.state }),
      el("span", { textContent: i.service }),
    ]),
    el("h3", { className: "sr", textContent: "Summary" }),
    el("p", { className: "detail-summary", textContent: i.summary }),
  ]);
}

function commanderControls(i) {
  const sev = el("select", { className: "control", title: "Change the severity" });
  sev.append(el("option", { value: "", textContent: "severity…" }));
  for (const s of ["sev1", "sev2", "sev3"]) if (s !== i.severity) sev.append(el("option", { value: s, textContent: s }));
  sev.addEventListener("change", () => sev.value && act(i.key, "severity", { severity: sev.value }));

  const to = el("select", { className: "control", title: "Hand this incident to somebody" });
  to.append(el("option", { value: "", textContent: "assign…" }));
  for (const r of state.directory) if (r.id !== i.assignee_id) to.append(el("option", { value: r.handle, textContent: r.handle }));
  to.addEventListener("change", () => to.value && act(i.key, "assign", { responder: to.value }));
  return [sev, to];
}

function detailActions(i) {
  const why = refusal(i);
  const acts = el("div", { className: "actions" });
  if (i.state === "resolved") {
    const by = i.timeline.findLast((e) => e.kind === "resolved")?.by ?? "somebody";
    acts.append(el("p", { className: "note", textContent: `Closed by ${by} — a closed incident is read-only, and a repeat of this alert opens a new one.` }));
    return acts;
  }
  acts.append(action(`Acknowledge ${i.key}`, "i-ack", {
    primary: i.state === "triggered",
    why: i.state === "acknowledged" ? `${i.ack_by} already has this one.` : why,
    run: () => act(i.key, "ack"),
  }));
  acts.append(action(`Resolve ${i.key}`, "i-resolve", { why, run: () => act(i.key, "resolve", { note: "closed from the console" }) }));
  acts.append(action("Snooze 20m", "i-snooze", {
    why: i.state !== "triggered" ? "Only an unanswered page can be snoozed." : why,
    run: () => act(i.key, "snooze", { minutes: 20 }),
  }));
  if (state.me?.role === "commander") acts.append(...commanderControls(i));
  return acts;
}

const detailFacts = (i) => el("dl", { className: "facts" }, [
  fact("opened", `${clockTime(i.opened_ms)}Z`),
  fact("age", duration((i.resolved_ms ?? state.now) - i.opened_ms)),
  fact("alerts", String(i.alert_count)),
  fact("step", i.next_escalation_ms ? `${i.step} · next in ${duration(i.next_escalation_ms - state.now)}` : String(i.step)),
  fact("acknowledged", i.acked_ms ? duration(i.acked_ms - i.opened_ms) : "—"),
]);

function detailColumns(i) {
  const tl = el("ol", { className: "timeline" });
  for (const e of i.timeline) {
    tl.append(el("li", { className: `mark-${e.kind}` }, [
      el("div", { className: "when", textContent: `${clockTime(e.at_ms)}Z` }),
      el("div", { className: "what" }, [
        el("b", { textContent: e.kind }),
        el("span", { textContent: `${e.by ? ` · ${e.by}` : ""}${e.note ? ` · ${e.note}` : ""}` }),
      ]),
    ]));
  }
  const outbox = el("ul", { className: "outbox" });
  for (const p of i.pages) {
    outbox.append(el("li", {}, [
      el("span", { className: "when", textContent: `${clockTime(p.at_ms)}Z` }),
      el("span", {}, [icon("i-page"), el("span", { textContent: ` ${p.responder} · ${p.reason}` })]),
    ]));
  }
  if (!i.pages.length) outbox.append(el("li", { className: "note", textContent: "Nobody was paged." }));
  return el("div", { className: "columns" }, [
    el("div", {}, [el("h3", { textContent: "Timeline" }), tl]),
    el("div", {}, [el("h3", { textContent: "Paged" }), outbox]),
  ]);
}

function renderDetail() {
  const panel = $("#detail");
  panel.replaceChildren(el("h2", { className: "sr", id: "detail-title", textContent: "Incident" }));
  const i = state.detail;
  if (!i || i.key !== state.selected) {
    panel.append(el("div", { className: "empty" }, [
      el("p", { className: "headline", textContent: "Pick an incident." }),
      el("p", { textContent: "The queue on the left is ordered newest first. Selecting one shows its timeline and everyone it paged." }),
    ]));
    return;
  }
  panel.append(detailHead(i), detailActions(i), detailFacts(i), detailColumns(i));
}

const fact = (term, value) => el("div", {}, [el("dt", { textContent: term }), el("dd", { textContent: value })]);

async function act(key, verb, body = {}) {
  try {
    await call(`/incidents/${key}/${verb}`, { method: "POST", body });
    await load();
    await select(key);
    toast(`${key} ${verb === "ack" ? "acknowledged" : verb === "severity" ? "re-graded" : `${verb}d`}.`);
  } catch (e) {
    toast(e.message, true);
  }
}

/* ── start ────────────────────────────────────────────────────────────── */

async function boot() {
  theme();
  $("#theme").addEventListener("click", () => theme(theme() ? "light" : "dark"));
  await load();
  const picker = $("#me");
  picker.append(el("option", { value: "", textContent: "nobody" }));
  for (const r of state.directory) picker.append(el("option", { value: r.handle, textContent: `${r.handle} · ${r.role}` }));
  picker.addEventListener("change", () => {
    const r = state.directory.find((x) => x.handle === picker.value);
    signIn(r ? `${r.handle}@relay.test` : null);
  });
  const remembered = localStorage.getItem("relay.email");
  if (remembered) {
    picker.value = remembered.split("@")[0];
    await signIn(remembered);
  }
  if (!state.selected && visible().length) select(visible()[0].key);
  // The clock only moves when somebody moves it, so this refresh is about what
  // other responders did, not about time passing.
  setInterval(load, 6000);
}

boot();
