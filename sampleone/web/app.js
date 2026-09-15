// app.js — the storefront. One fetch helper, one render per surface.
//
// The token is kept in sessionStorage and never in a cookie: this page is
// served from the same origin as the API, so there is nothing to protect
// against CSRF with, and a token that dies with the tab is one fewer thing to
// revoke during a demo.
const $ = (s) => document.querySelector(s);
const money = (cents, currency = "USD") => `${currency} ${(cents / 100).toFixed(2)}`;

let token = sessionStorage.getItem("sampleone.token") || "";

async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, body: json };
}

async function ensureToken() {
  if (token) return token;
  const email = `guest-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const r = await api("POST", "/auth/token", { email });
  token = r.body.token || "";
  sessionStorage.setItem("sampleone.token", token);
  return token;
}

async function loadCatalogue(q = "") {
  const r = await api("GET", `/products?q=${encodeURIComponent(q)}`);
  const { items, total } = r.body;
  $("#catalogue-note").textContent = q
    ? `${total} product${total === 1 ? "" : "s"} match “${q}”.`
    : `${total} products.`;
  $("#catalogue").innerHTML = items.map((p) => `
    <li class="card">
      <span class="sku">${p.sku}</span>
      <strong>${p.name}</strong>
      <span class="price">${money(p.price_cents)}</span>
      <span class="${p.stock ? "" : "out"}">${p.stock ? `${p.stock} in stock` : "Out of stock"}</span>
      <button data-add="${p.id}" ${p.stock ? "" : "disabled"}>Add to cart</button>
    </li>`).join("");
}

async function renderCart() {
  await ensureToken();
  const r = await api("GET", "/cart");
  const c = r.body;
  const count = (c.lines || []).reduce((a, l) => a + l.qty, 0);
  $("#cart-count").textContent = count;
  $("#cart-lines").innerHTML = (c.lines || []).map((l) => `
    <li>
      <span>${l.name} &times; ${l.qty}</span>
      <span>${money(l.line_cents, c.currency)}
        <button data-remove="${l.id}" aria-label="Remove ${l.name}">Remove</button>
      </span>
    </li>`).join("") || "<li>Nothing in the cart yet.</li>";
  $("#cart-totals").innerHTML = count ? `
    <dt>Subtotal</dt><dd>${money(c.subtotal_cents, c.currency)}</dd>
    <dt>Shipping</dt><dd>${c.shipping_cents ? money(c.shipping_cents, c.currency) : "free"}</dd>
    <dt>Tax</dt><dd>${money(c.tax_cents, c.currency)}</dd>
    <dt>Total</dt><dd><strong>${money(c.total_cents, c.currency)}</strong></dd>` : "";
  $("#checkout").hidden = count === 0;
}

document.addEventListener("click", async (e) => {
  const add = e.target.closest("[data-add]");
  if (add) { await ensureToken(); await api("POST", "/cart/lines", { product_id: add.dataset.add, qty: 1 }); await renderCart(); return; }
  const rm = e.target.closest("[data-remove]");
  if (rm) { await api("DELETE", `/cart/lines/${rm.dataset.remove}`); await renderCart(); return; }
  if (e.target.id === "open-cart") {
    const cart = $("#cart");
    cart.hidden = !cart.hidden;
    e.target.setAttribute("aria-expanded", String(!cart.hidden));
    if (!cart.hidden) renderCart();
  }
});

$("#find").addEventListener("submit", (e) => { e.preventDefault(); loadCatalogue($("#q").value); });

$("#checkout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const r = await api("POST", "/checkout", {
    address: { name: f.get("name"), line1: f.get("line1"), city: f.get("city"), postcode: f.get("postcode"), country: f.get("country") },
    payment: { method: "card", last4: f.get("last4") },
  });
  if (r.status === 201) {
    $("#checkout-problems").textContent = "";
    $("#cart-lines").innerHTML = `<li>Order ${r.body.id} placed — ${money(r.body.total_cents, r.body.currency)}.</li>`;
    $("#cart-totals").innerHTML = "";
    $("#checkout").hidden = true;
    $("#cart-count").textContent = "0";
    return;
  }
  const problems = (r.body.problems || []).map((p) => `${p.in || ""} ${p.field || p.product_id || ""}: ${p.why}`.trim());
  $("#checkout-problems").textContent = problems.length ? problems.join("; ") : r.body.error || "The order was not accepted.";
});

loadCatalogue();
renderCart();
