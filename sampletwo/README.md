# sampleTwo — Relay, an on-call incident service

The second service in this workspace, and the second measurement. sampleOne is
CRUD and money; Relay is events and time — alert intake, deduplication,
rotations, escalation, and a clock that only moves when somebody moves it.

Six monitored services, three escalation policies, two rotations, eighteen
routes, and a console. No dependencies.

## What it is for

The same question sampleOne answers, asked of a service whose defects are
ordering and timing rather than arithmetic: **what does bundlebox cost, and what
does it find, on real work?**

| | tokens a session reads |
|---|---|
| read the source (37.4k over 17 files) and the log (22.9k) | **60,300** |
| `bb scan`, `bb findings`, `bb cookbook run`, `bb runbook logs`, `bb runbook status` | **519** |
| | **−99.1%**, in 9.9 seconds, 0 model tokens |

Measured with `bb tokens estimate` over the tree and over the captured stdout of
those five verbs, on this tree, at the state committed here.

## What the corpus found that the unit tests did not

26 unit tests were passing, including four about snooze. The scenario corpus,
run against the live service, went red on this:

> **a snooze moved only the next escalation step.** The later steps were still
> measured from the instant the incident opened, so the moment the snooze ended
> they all came due at once — and fired in the same tick as the step that had
> been delayed, carrying instants *earlier* than it. A twenty-minute snooze on a
> tier-1 incident woke the holder and escalated past them to the commander in
> the same breath.

The unit tests could not see it because each of them asserted on one step. The
corpus advances a clock and reads the whole outbox, which is where an ordering
defect lives. The fix is in `src/incidents.js`: a snooze shifts the whole
policy, not the next step, through `escalation_shift_ms`. `test/surface.test.js`
now carries a regression test that names where it came from.

That is the same shape as sampleOne's four: not a rule anybody wrote down
wrong, a consequence nobody had run.

## The state now

| | |
|---|---|
| detectors | 18, ~80ms, 0 tokens — 1 open finding (`god-file` on `web/console.js`, 412 lines) |
| `ui-generic` | **0 tells** across 3 interface files |
| unit tests | 26, all green, `node --test` |
| scenario corpus | 11 scenarios, 80 steps, 9 surfaces, **100%**, 9.5s, 83 requests |
| routes | 18, every one reachable and none shadowed (asserted) |

## What a model was paid for

One packed call, through `bb bridge`, for the HTML monitor:

| | |
|---|---|
| brief | 1.8k tokens, evidence via `bb pinpoint` |
| billed | 2,004,581 tokens — 48 fresh, 105.2k cache writes, 1.87M cache reads, 30.6k output |
| **cost** | **$1.1010**, MEASURED, 39 turns, 327 seconds |
| produced | `scripts/monitor.mjs` and `monitor/index.html`, which run and render |

Against that, `bb session` puts the work the free verbs displaced at 370 turns —
$6.34 at the low bound, $19.90 at the high one, both estimates over measured
inputs.

`bb run --apply` did not execute here: the routed lane's `cwd` and `worktree`
are the same path, so `ensureWorktree` returns "shared checkout" and never
creates the directory the lane is then spawned in. The spawn fails ENOENT and is
reported as `rc 127 (binary not found: claude)`, which names the wrong cause.
Written up in the workspace's `GAPS.md`.

## The console

`web/` is an operator console, not a page of cards: a masthead carrying the
service clock and who holds each pager, a shift bar with the review figures, a
dense queue on the left and the selected incident's timeline and outbox on the
right.

The decisions it makes, because `ui-generic` counts the ones that go unmade:

- **Typography.** Newsreader for the sentence a responder reads at 03:00, IBM
  Plex Sans for the interface, IBM Plex Mono for every instant, duration and id.
  Figures are tabular everywhere, so a column of durations does not dance.
- **Colour.** A warm bone ground and a petrol accent, with severity on its own
  warm scale. Nothing is from a framework ramp. Severity is never colour alone:
  a spine, a small-caps label and a weight, so it survives greyscale and a
  projector.
- **Radius and elevation carry hierarchy** — 3px on chips through 18px on the
  sheet, and three elevations, not one shadow on everything.
- **Both grounds.** The palette is declared once for day and night; the
  preference is the default and the toggle wins over it in either direction.
- **The states that are not the happy one.** Loading is a skeleton, empty says
  what is empty, an unreachable service says so with a retry, and an action you
  may not take is drawn, focusable, and tells you *why* when you press it —
  which is the authorisation rule from `src/auth.js`, mirrored.
- **Icons are drawn here**, one stroke weight on one grid. No emoji.

## Running it

```bash
bb runbook up api --apply --wait                  # the service on :8600
bb cookbook run --base http://127.0.0.1:8600      # 11 scenarios, 80 steps
npm test                                          # 26 unit tests
node scripts/monitor.mjs                          # rebuild monitor/index.html
bb scan && bb findings                            # 18 detectors, 0 tokens
bb session                                        # what it used and what it saved
```

The console is at `http://127.0.0.1:8600/`. Sign in as `nadia` to answer a page,
`wren` to move the clock.

## The clock

The single decision the service is built around. Escalation is elapsed time, and
a service whose only clock is `Date.now()` can be tested one way: by waiting.
Here the clock is a value in the store, `POST /admin/clock` moves it forward, and
every deadline is an instant beside it. That is what makes a corpus that asserts
"the sixth minute reaches tomas" run in nine seconds instead of an hour — and it
is why the console counts age from the instant the *server* reported rather than
from the browser's clock.

`SAMPLETWO_CLOCK=wall` gives a deployment the system clock, and the advance
endpoint then refuses rather than pretending to have moved time.
