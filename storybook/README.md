# storybook

Prompts that build systems, and the arithmetic that says what one will cost.

```
inlet/<story>.json  +  patterns/*.md   ->   node build.mjs <story>   ->   outlet/<story>/
```

## The three parts

**`inlet/`** — one JSON per story: the thesis, the unit of work, the surfaces,
the contracts, the gates, the lanes, and a `reference` tree the lanes are
measured against. A story that names no reference tree can only guess at its own
size, and a guessed budget is decoration.

**`patterns/`** — ten markdown files, in order, each answering one question about
how a system gets built and naming the failure it prevents. They are carried
byte-identically into every lane prompt, which is what lets the prompt cache
treat them as one prefix rather than ten.

**`outlet/`** — generated, never edited by hand:

| file | what it is |
|---|---|
| `PROMPT.md` | the whole-system prompt: thesis, surfaces, lane index, gates, pattern pack |
| `lanes/L*.md` | one prompt per lane — what it writes, what it may read, its contracts, its acceptance command, its own budget |
| `BUDGET.md` | the accounting, with every term and where it came from |
| `budget.json` | the same numbers, for a tool |

## The budget

Two totals, never added.

**Wired** — what the agent spends with bundlebox in front of it:

```
projected = overhead + brief + payload × churn + reserve
```

Every term is measured or comes from config: overhead off bundlebox's own
reference workspace, payload by `estimate.files` over the real tree, churn and
the widening allowance from `budget.churn_factor` and `budget.anchor_widen`.

**Unwired** — the same lanes with nothing packing the brief first. Four terms,
each named, reported as a **range** and labelled ESTIMATE:

| term | why it differs |
|---|---|
| overhead | 44.3k a session against 29.2k, for want of a lean flag stack |
| orientation | 15–35% of the tree, opened to find what the brief already said |
| payload | whole files instead of located regions, still multiplied by churn |
| sessions | unpacked work does not fit one window; each extra one pays the opening cost again |

The orientation term is the thesis. An agent is billed for what it reads, and
most of what it reads is orientation, not judgement.

## The stories

| story | builds | reference tree | wired | unwired | ratio |
|---|---|---|---|---|---|
| `factory` | a zero-token software factory, 10 lanes in 3 waves | `../bundlebox/src`, 346.1k | **618k** | 1352k – 2427k | 2.2× – 3.9× |
| `service` | the worklist service in `demo/`, 4 lanes in 2 waves | `demo/src`, 3.0k | **142k** | 190k – 193k | 1.3× – 1.4× |

Every wave in both comes in under its declared budget — `factory` at 350k a
wave, `service` at 120k. A wave is sized to the work, not to the window, which
is why the two stories declare different ones.

The low end of `factory`'s unwired range, 1.35M, lands on the figure bundlebox
measured independently on its own reference workspace: *5 sessions, 1.3M
projected.* Two routes to one number is the only reason to quote either.

## What running it at two scales shows

**The ratio is a function of the tree, not of the tool.** `factory` reads a
346.1k-token tree and gains 2.2×–3.9×. `service` reads a 3.0k-token tree and
gains 1.3×–1.4×. The difference is entirely the orientation term: on a small
tree there is almost nothing to survey, so there is almost nothing to pack away,
and the session-opening overhead is most of the bill either way.

Which means the honest claim is narrower than the headline number. bundlebox
earns its keep on a tree large enough that finding things costs more than doing
them. On a four-file service it is close to break-even, and `service` is in this
directory so that number is visible rather than quietly omitted.

## Adding a story

1. Write `inlet/<id>.json`. Name a real `reference.root` and `reference.scan`.
2. Keep every `reads` entry a **file**, not a directory — pattern 07 applies to
   the story as much as to the prompt it generates.
3. `node build.mjs <id>`.
4. Read `BUDGET.md`. A wave that is `SPLIT` or `HEAVY` gets cut, not rounded up.
