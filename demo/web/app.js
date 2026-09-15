/* app.js — the demo UI against the real API. No framework, no build. */
const $ = (s) => document.querySelector(s);
const api = (p, opts) => fetch(p, { headers: { "content-type": "application/json" }, ...opts });

let filter = "";

async function refresh() {
  const res = await api("/items" + (filter ? `?state=${filter}` : ""));
  const { items } = await res.json();
  $("#count").textContent = `(${items.length})`;
  $("#list").replaceChildren(...items.map(row));
}

function row(it) {
  const el = document.createElement("div");
  el.className = "row";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = it.title;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = it.due ? new Date(it.due).toLocaleDateString() : "no date";
  const chip = document.createElement("button");
  chip.className = "chip " + it.state;
  chip.textContent = it.state;
  chip.addEventListener("click", async () => {
    const next = { open: "doing", doing: "done", done: "open" }[it.state];
    await api(`/items/${it.id}`, { method: "PATCH", body: JSON.stringify({ state: next }) });
    refresh();
  });
  const del = document.createElement("button");
  del.className = "chip";
  del.textContent = "🗑";
  del.addEventListener("click", async () => {
    await api(`/items/${it.id}`, { method: "DELETE" });
    refresh();
  });
  el.append(title, meta, chip, del);
  return el;
}

$("#add").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#err").textContent = "";
  const res = await api("/items", {
    method: "POST",
    body: JSON.stringify({ title: $("#title").value, due: $("#due").value || null }),
  });
  if (!res.ok) {
    const body = await res.json();
    $("#err").textContent = body.error || "Something went wrong";
    return;
  }
  $("#title").value = "";
  $("#due").value = "";
  refresh();
});

for (const chip of document.querySelectorAll("#filters .chip")) {
  chip.addEventListener("click", () => { filter = chip.dataset.state; refresh(); });
}

$("#cta").addEventListener("click", () => $("#title").focus());
refresh();
