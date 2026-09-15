# bundlebox-projects

A workspace for building things *with* bundlebox, and for finding out where
bundlebox is wrong by using it on real work rather than on a fixture.

Three directories, each with a different job.

| | what it is | what it proves |
|---|---|---|
| `sampleone/` | an ecommerce platform — catalogue, cart, checkout, orders, admin | the whole factory against one service, **measured**: 32,080 tokens of source and log answered in 869, and four real defects the unit tests did not reach, found by the corpus over the wire. [Its README carries every number](sampleone/README.md), and [the HTML monitor](sampleone/monitor/index.html) is built from the artefacts |
| `sampletwo/` | an on-call incident service — alert intake, deduplication, rotations, escalation on a clock that can be moved, and a console | the same factory against a service whose defects are **ordering and timing**: 60,300 tokens of source and log answered in 519, and a snooze that moved only the next escalation step — found by the corpus, invisible to 26 passing unit tests. [Its README carries every number](sampletwo/README.md) |
| `demo/` | a real service and the UI in front of it | the full pipeline — `scan → compile → route → run` — against code that exists, and `bb cookbook` against the process while it runs |
| `designlabs/` | a declared design system and the gate that holds it | that a design system can be checked by a parse, and that what a parse cannot settle is reported `unknown` |
| `tokenlab/` | a task service, and a harness that measures `bb bench` across trees of known size | that the packed arm is CONSTANT while the bare arm pays for the repository — 3.9k tokens whether the tree is 12 files or 400 |
| `storybook/` | prompts that build systems, with their arithmetic | that the number at the bottom of a prompt can be measured instead of asserted — at two scales, so the limit shows as well as the win |

One git repository at the top. It began as a workspace of independent projects
with git in each of them, and `demo/` carried its own so a lane scoped there
could get a worktree; that made the workspace itself unclonable, which is a
worse problem than the one it solved. `bb git` now acts at this root, and a lane
scoped to a directory gets a worktree of this repository.

## Running it

```bash
cd sampleone && bb runbook up api --apply --wait && bb cookbook run --base http://127.0.0.1:8500
cd sampleone && node scripts/monitor.mjs      # rebuild the HTML monitor from the artefacts

bb scan                       # 17 detectors, ~130ms, 0 tokens
bb findings                   # what they found
bb designlabs check           # the design gate: contrast, states, motion, targets
bb compile --write            # findings -> units packed to one window
bb route --write              # units -> lanes
bb run                        # writes the prompt and the command; spawns nothing
bb run --apply                # the only verb that spends
bb session                    # what it used and what it saved, MEASURED
bb git status                 # acts on this repository

cd demo && npm start &        # the service on :8420
bb cookbook check             # every corpus validates — no server, no requests
bb cookbook run --base http://127.0.0.1:8420    # what the RUNNING system does

cd demo && npm test
node storybook/build.mjs factory
node designlabs/selftest/contract.mjs designlabs
```

## sampleOne, in one table

One question — *does sampleOne hold, and what is wrong with it?* — answered two
ways, on this tree:

| | tokens a session reads |
|---|---|
| read the source (19,354) and the log (12,726) | **32,080** |
| `bb scan`, `bb findings`, `bb cookbook run`, `bb runbook logs`, `bb runbook status` | **869** |
| | **−97.3%**, in 8.4 seconds, 0 model tokens |

The corpus's first run against a live service found six red steps. Four were
real — a forged token answered `403` instead of `401`, a fractional quantity
silently truncated in two places, and `DELETE /cart/lines/:id` shadowed by the
`PATCH` row above it — and none of them were reachable by the twelve unit tests
that were passing at the time. [The whole measurement is in sampleone/README.md](sampleone/README.md).

## The arc

`demo/web/` is deliberately the generic version: the framework's palette, one
radius, one shadow, emoji for icons, template copy, `:hover` styled and
`:focus-visible` never. `bb scan` names all of it with file and line evidence,
per directory, for nothing.

`designlabs/` is the same product after those decisions were actually made —
two chosen typefaces, a hue committed to, a non-linear spacing scale, and six
states declared per screen. It passes its own gate, and the rules a static pass
cannot settle are printed `unknown` rather than green.

`storybook/` prices the work twice, at two scales. Building a factory against a
346.1k-token tree: **618k through the wire, 1.35M–2.43M without it**. Building
the service in `demo/` against a 3.0k-token tree: **142k against 190k–193k**.
The ratio is a function of the tree, not of the tool — and the small one is kept
in the directory precisely because it is the unflattering number.

`bb cookbook` closes the last gap between the two halves. The detectors ask what
the files say; the corpus asks what the process does. Five scenarios, seventeen
steps, both surfaces at 100% — including every refusal path and the lifecycle
through to a 404 after delete.

## Configuration

`.bundlebox/config.json` — gates per scope, lane model `sonnet`, `$2` a lane and
`$10` a day. Lanes are capped deliberately: the whole point of the tree is to
find out what the free verbs can do before anything is spent.
