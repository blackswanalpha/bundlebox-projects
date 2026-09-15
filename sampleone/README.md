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
| without the factory | **22,244** | read the source (19,369) and the log (2,875) |
| with it | **1,105** | five tables, each with file, line and evidence |
| | **−95.0%** | and the five tables took 13 seconds and 0 model tokens |

The 1,105 breaks down as: `bb scan` 162, `bb findings` 327, `bb cookbook run`
112, `bb runbook logs` 460, `bb runbook status` 44.

Run `bb scan` a second time on an unchanged tree and its 162 becomes **17**: the
fingerprint has not moved, so nothing is re-derived.

The log here is **one** corpus run. An earlier version of this table quoted six
of them — 12,726 tokens against 423, −96.7% — which is a better-looking number
for the same mechanism. The ratio is a function of how much log there is, not of
the digest, so the single run is the one quoted.

```bash
bb scan && bb findings && bb cookbook run --base http://127.0.0.1:8500 \
  && bb runbook logs --all && bb runbook status
```

## What each verb cost, and what it found

### `bb scan` — the source, 0 tokens

```
18 detectors · 85 ms · 11 findings · 1 promotable · 0 model tokens
```

Eleven findings with file-and-line evidence: `dead-exports` on the modules that
export helpers nothing imports yet, one `anti-slop` hit in `web/app.js`, and a
`doc-links` finding this README earned by growing.

A second scan over an unchanged tree prints **one line, 17 tokens, 73 ms**.

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
browser what a customer sees — `bb dotty` over the Chrome DevTools
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

### `bb runbook logs` — 7.2 kB of log as 33 rows

```
133 lines · 0 E · 28 W · 33 distinct signatures · via kernel

known failures
  medium  auth-refused    ×4   A request was refused for identity. Expected in the auth scenarios…
  low     card-declined   ×1   A payment was declined. Expected for a card ending 0000…

top signatures
  INFO POST /cart/lines # #ms
  WARN POST /checkout # #ms
  INFO GET /products # #ms
```

| | |
|---|---|
| the log, read whole | **2,875 tokens** |
| the same log, digested | **460 tokens** |
| | **−84.0%** |

Six runs of the corpus instead of one make that −96.7%, for the same reason and
with no change to the digest: the saving grows with the log, because the rows
do not.

The monitor page reports a slightly larger saving on the same log, because it
counts the signature rows alone and this table counts everything
`bb runbook logs` prints — the header, the totals line and the sentence at the
bottom explaining what a signature is. Both are measured; they are measuring
two different things, and the one here is the one a session reads.

The second call reads **0 bytes**: a cursor per file means only what arrived
since last time is read.

On a 3.9 MB, 40,000-line log the same op returns 5 signatures in **61 ms** in
the Rust kernel against **196 ms** in the JavaScript port — 3.2× — and the
second call in **3 ms**. Both engines are pinned to identical answers by
`test/digest.test.js` in the bundlebox repo.

### `bb dotty` — the screen, as rows, 0 tokens

The seven API surfaces cannot see the page a customer opens. The eighth can:

```
$ bb dotty shot catalogue --url http://127.0.0.1:8500/
  catalogue        ok  780x437  29.0kB  .bundlebox/var/dotty/…/catalogue.png
  sampleOne  http://127.0.0.1:8500/
    role       name                         
    searchbox  Search the catalogue
    button     Add Four-port hub to cart    disabled
    button     Add USB-C cable, 2m to cart
    …
```

The picture is for a person. The rows are what a session reads, and the gap is
the point — measured on this page:

| what a session could read to know this screen | tokens | |
|---|---|---|
| the raw accessibility tree, as CDP returns it | **28,059** | 211 nodes of protocol bookkeeping |
| the rendered DOM | **1,812** | 5,020 bytes of markup |
| `bb dotty`'s screen rows | **302** | 16 rows |
| the PNG | — | 29 kB, and neither greppable nor diffable |

**The raw accessibility tree is fifteen times the DOM here.** "Hand the model
the accessibility tree" is bad advice unfiltered; the filtering is the whole
value. `bb dotty` keeps the roles a customer can act on — button, link, textbox,
heading, alert — and drops the rest, which is how 211 nodes become 16 rows and
28k tokens become 302.

Filtering to what a customer can act on is the same trade as a signature instead
of a log line, one surface over.
It also survives a CSS refactor, which a selector does not, and it can be
compared with the frame taken ninety seconds ago, which an image cannot:

```
$ bb dotty during restock --reload -- curl -X POST …/admin/stock/p6 -d '{"stock":9}'
  what changed: 1 appeared, 1 gone, 15 unchanged
    +  button  Add Four-port hub to cart
    -  button  Add Four-port hub to cart  disabled
```

A frame that came back single-coloured is marked **BLANK** and the verb exits 1.
The check is a real one — inflate the PNG, reverse the scanline filters, compare
a grid of pixels — not a guess at the file size.

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
