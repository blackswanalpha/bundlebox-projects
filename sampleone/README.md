# sampleOne

An ecommerce platform — catalogue, cart, checkout, orders, admin — that exists
to measure bundlebox. Ten products, two customers, one operator, no
dependencies, and a service that starts in under half a second so the same
question can be asked of it a hundred times.

Everything below was measured on this tree. Regenerate any of it with the
command next to it.

**[The HTML monitor, saved from these runs →](monitor/index.html)**
&nbsp;·&nbsp;
[view it rendered](https://htmlpreview.github.io/?https://github.com/blackswanalpha/bundlebox-projects/blob/main/sampleone/monitor/index.html)
&nbsp;·&nbsp;
[on GitHub](https://github.com/blackswanalpha/bundlebox-projects/blob/main/sampleone/monitor/index.html)

Every number on that page is read out of a JSON artefact bundlebox wrote —
the board, the findings, the digest, the records. Rebuild it with
`node scripts/monitor.mjs`.

---

## The headline

One question — *does sampleOne hold, and what is wrong with it?* — answered two
ways.

| | tokens a session reads | how |
|---|---|---|
| without the factory | **32,080** | read the source (19,354) and the log (12,726) |
| with it | **869** | five tables, each with file, line and evidence |
| | **−97.3%** | and the five tables took 8.4 seconds and 0 model tokens |

The 869 breaks down as: `bb scan` 17, `bb findings` 281, `bb cookbook run` 104,
`bb runbook logs` 423, `bb runbook status` 44.

```bash
bb scan && bb findings && bb cookbook run --base http://127.0.0.1:8500 \
  && bb runbook logs --all && bb runbook status
```

## What each verb cost, and what it found

### `bb scan` — the source, 0 tokens

```
18 detectors · 74 ms · 9 findings · 0 model tokens
```

Nine findings with file-and-line evidence: 8 `dead-exports` (modules exporting
helpers nothing imports yet) and 1 `anti-slop` (a conditional empty spread in
`web/app.js`). None promoted to a work unit, which is correct — one `info` hit
of one rule is a note, and `bb compile` says `no work units — nothing promoted`
rather than inventing work.

A second scan over an unchanged tree prints **one line, 17 tokens, 71 ms**: the
fingerprint has not moved, so nothing is re-derived.

### `bb runbook up api --apply --wait` — a readiness gate, 0 tokens

```
sampleone  up  via systemd  .bundlebox/var/logs/sampleone.log
sampleone  up  200  26.6ms  after 2 probes
every service answers. A board run now is about the product.
```

**488 ms** from nothing to a service that answers, caged at 256M with
`MemoryMax`, `MemoryHigh` at 90% and `MemorySwapMax=0`. The wait is what makes
the next line worth reading: a corpus run against a service that has not
finished booting produces 76 red steps, 14 findings and a session spent reading
a board about nothing.

`bb runbook perf` says it settles at **20M of its 256M cage, 8%**.

### `bb cookbook run` — what the running system does, 0 tokens

```
17 scenarios · 92 steps · 8 surfaces · 12 s · 87 requests · kernel engine · 0 model tokens
```

Seven of those surfaces are the API. The eighth is `storefront`, and it asks the
browser what a customer actually sees — `bb dotty` over the Chrome DevTools
Protocol, with the accessibility tree as the assertion target rather than a
screenshot. A scenario reads like the others:

```json
{ "run": "bb dotty shot out-of-stock --url {{base}}/ --json",
  "expect": { "rc": 0,
    "contains": { "screen": { "role": "button",
      "name": "Add Four-port hub to cart", "disabled": true } } } }
```

`rc 0` already means the frame was not blank. Each storefront scenario opens
with a `precondition` step asking whether a browser is listening, so on a box
without one the surface reports **blocked** — the environment — rather than
nine red steps claiming the storefront is broken.

**The first run was not green.** It found six red steps, and four of them were
real:

| what the corpus said | what it was |
|---|---|
| `GET /admin/stock`: status 403, expected 401 | a forged token was answered `403 admin only` — which tells the forger it parsed. 401 and 403 answer different questions |
| `POST /cart/lines` qty 1.5: status 200, expected 422 | `Math.trunc(1.5)` silently charged for 1. The service was deciding what the customer meant |
| `POST /admin/stock/p6` stock 2.5: status 200, expected 422 | the same truncation on the shelf |
| `DELETE /cart/lines/:id`: status 405, expected 404 | the `PATCH` row above it matched the path first and returned 405 for a route that exists |

The fifth and sixth were the corpus's own fault: a scenario left a line in the
cart, so the next one's "an empty cart cannot check out" step was not testing an
empty cart. Fixed in the corpus, not in the product.

All four defects are in code paths that `npm test` (12 tests, all passing at the
time) did not reach — they are the paths that only exist over the wire.

After the fixes: **92 of 92, every surface at 100%.**

**The storefront surface found a fifth defect, and it was an accessibility one.**
Ten products rendered ten buttons all named `Add to cart`, so nothing could tell
them apart — not a screen reader, and not a scenario, which was reduced to
counting how many were disabled. Counting made the assertion depend on what
earlier surfaces had sold. The fix was an `aria-label` carrying the product
name, and the scenario now asserts on the one button it means.

### `bb runbook logs` — 27.6 kB of log as 29 rows

```
496 lines · 0 E · 162 W · 29 distinct signatures · via kernel   (188 ms)

known failures
  medium  auth-refused    ×24  A request was refused for identity. Expected in the auth scenarios…
  low     card-declined   ×6   A payment was declined. Expected for a card ending 0000…

top signatures
  72  INFO POST /cart/lines # #ms
  48  WARN POST P # #ms
  36  WARN POST /checkout # #ms
```

| | |
|---|---|
| the log, read whole | **12,726 tokens** |
| the same log, digested | **423 tokens** |
| | **−96.7%** |

The second call reads **0 bytes**: a cursor per file means only what arrived
since last time is read.

On a 3.9 MB, 40,000-line log the same op returns 5 signatures in **61 ms** in
the Rust kernel against **196 ms** in the JavaScript port — 3.2× — and the
second call in **3 ms**. Both engines are pinned to identical answers by
`test/digest.test.js` in the bundlebox repo.

### `bb recom` — the run that does not have to happen again

```
fresh  sampleone/corpus-all-green  works  The 14-scenario corpus runs green against a live sampleOne
1 of 1 still hold
they stand in for 10 minutes of driving and ~24k tokens, every time one is read instead of run
```

| | |
|---|---|
| running the corpus | 488 ms to start + **8 s**, 81 requests |
| reading the record | **176 ms**, 3 facts re-probed |

The record declares the facts its answer rests on — the six source files, the
corpus persona, and the health endpoint — and they are re-probed on every read.
Touch `src/orders.js` and it goes `stale` and names the fact that moved with
both values. A record is not a cache: one that could not go stale would be
replayed for ever.

### `bb slop` — the prose, before anyone is billed for it

`docs/PRD.md: clean`. Every brief, commit message and PR body bundlebox writes
now goes through the same ruleset before it is handed to a lane.

## Running it

```bash
npm run seed                                     # the fixed ten-product catalogue
bb runbook up api --apply --wait                 # caged, and returns when it ANSWERS
npm test                                         # 12 tests, ~200 ms, no socket
bb scan && bb findings                           # the source, 0 tokens
bb cookbook check                                # the corpus validates: no server, no requests
bb cookbook run --base http://127.0.0.1:8500     # what the running system does
bb cookbook run --only storefront                # just the browser surface (needs Chrome on 9222)
bb dotty shot catalogue --url http://127.0.0.1:8500/   # one frame, and the screen as rows
bb runbook logs --level E --sample               # errors only, one real line each
bb recom list                                    # what has already been driven, and whether it holds
node scripts/monitor.mjs                         # rebuild monitor/index.html
bb runbook down api --apply
```

Without bundlebox on the path, `npm start` and `npm test` run and exercise the
service on their own.

## What is in here

| | |
|---|---|
| `src/money.js` | every amount is integer cents; tax in basis points, on the subtotal, once |
| `src/store.js` | the whole database: one JSON file, written atomically via rename |
| `src/auth.js` | HMAC tokens, constant-time compare, one `owns` check every scoped read goes through |
| `src/catalog.js` | search, and `reserve` — the one place stock leaves the shelf, all or nothing |
| `src/cart.js` | one line per product, re-priced on every read, quantities are whole numbers |
| `src/orders.js` | validate → reserve → authorise → commit, and the release path when payment fails |
| `src/server.js` | the only file that knows about HTTP; handlers return `{status, body}` |
| `web/` | the storefront: one hue, one scale, `:focus-visible` before `:hover` |
| `docs/PRD.md` | the document `bb genesis` reads — surfaces, 14 rules, every capability |
| `.bundlebox/cookbook/sampleone/` | 17 scenarios, 92 steps, 8 surfaces, two customers and an operator — seven over the API and one over the browser |
| `.bundlebox/runbook/` | the service table and 7 named failure buckets |
| `.bundlebox/recom/records/` | what has already been driven |
| `monitor/index.html` | the page above, built from the artefacts |

## Why the corpus has two customers

A tenancy leak is invisible in a corpus that runs as one user. `orders-tenancy-holds`
places an order as Ada and then asks for it as Bo, and asserts that the answer
is byte-identical to the answer for an order id that never existed. A `403`
there would confirm the id is real, which is the whole of an enumeration attack.

## Why the service is deliberately small

No payment processor, no email, no database server. A container between
`bb runbook up` and the first scenario would be the thing being measured. Ten
products, one JSON file, a 40 ms start — so the expensive question can be asked
over and over, and the number that comes back is about bundlebox.
