# tokenlab

Two things in one directory, both about the same question: **what does bundlebox
actually save, and what is that number a property of?**

| | what it is | what it is for |
|---|---|---|
| `src/` | a small task service on `127.0.0.1:8422` | something real for `bb cookbook` to assert against and `bb simulate` to put under load |
| `bench/` | a tree generator and a lab runner | measuring `bb bench` across trees of known size and read budgets of known size |

Nothing here calls a model. Both arms of every measurement are token counts
over files on disk, produced by `bb bench` — the same instrument the command
centre reads.

## The service

```bash
npm start                                  # http://127.0.0.1:8422
npm test                                   # 10 tests, no network

curl -s localhost:8422/health
curl -s -XPOST localhost:8422/tasks -H 'content-type: application/json' -d '{"title":"first"}'
curl -s localhost:8422/tasks/tk-nope       # 404, and it names the id
curl -s -XDELETE localhost:8422/health     # 405, and it names the allowed methods
```

Every refusal says which field was wrong and what was allowed. A `400 invalid`
costs the caller a session to diagnose, and that cost is the thing this
workspace exists to measure.

| route | |
|---|---|
| `GET /health` | `{ok, service, uptime_s}` |
| `GET /tasks` · `POST /tasks` | list; create, with `version: 1` |
| `GET /tasks/:id` · `PATCH /tasks/:id` · `DELETE /tasks/:id` | read; write, incrementing `version`; delete, then 404 |
| `GET /lab` | the last lab run, so a dashboard can read it without a shell |

## The lab

```bash
npm run lab          # generates the trees if absent, then measures
npm run trees        # just the trees
```

Three generated trees — 12, 80 and 400 modules — and the same five tasks run in
each, at three read budgets. Measured on this box:

```
tree    files  hits  read  bare    packed  share  ratio
------  -----  ----  ----  ------  ------  -----  -----
small   12     12    4     18.0k   3.9k    78.2%  4.6x
               12    10    45.8k   3.9k    91.5%  11.7x
               12    25    52.3k   3.9k    92.5%  13.3x
medium  80     80    4     21.6k   3.9k    81.9%  5.5x
               80    10    48.1k   3.9k    91.8%  12.3x
               80    25    114.8k  3.9k    96.6%  29.3x
large   400    400   4     21.6k   3.9k    81.9%  5.5x
               400   10    54.0k   3.9k    92.8%  13.8x
               400   25    129.9k  3.9k    97.0%  33.2x
```

- **hits** — how many files the search returned. It grows with the tree: 12 to 400.
- **read** — how many of those a bare session opens before it starts editing.
  This is the one assumption in the lab, so it is swept rather than picked.
- **bare** — tokens to search and read those files whole.
- **packed** — tokens in the one `bb pinpoint` prompt for the same task.

### The finding is not the percentage

The share moves between 78% and 97% depending on how big the tree is and how
much of it a bare session opens. Quoting the top row of that range as "what
bundlebox saves" would be quoting the best case as the behaviour.

What actually holds across all nine rows is the middle column: **the packed arm
is constant at 3.9k tokens.** A pinpoint prompt costs what the *task* costs. The
bare arm pays for the repository — which is why the ratio goes from 4.6x to 33x
without bundlebox doing anything differently.

That is the claim worth making, and it is falsifiable: regenerate the trees,
change `CAPS`, and the packed column should still not move.

### What it does not measure

The bare arm is a model of a session with no factory in front of it: search,
then read the top *n* files whole. A real session interleaves, stops early,
sometimes reads one file and is done — and sometimes reads twenty. The lab
reports its assumption in a column instead of hiding it in a constant, but it is
still an assumption, and no row here is a measurement of a model's output
tokens. `bb session` measures those, off the transcript, and the two numbers are
never added.

## Wiring it into bundlebox

```bash
npm start &
bb cookbook run tokenlab --base http://127.0.0.1:8422    # what the service does
bb simulate run smoke --base http://127.0.0.1:8422       # what it does at 32 callers
```
