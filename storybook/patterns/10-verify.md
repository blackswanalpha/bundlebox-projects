# 10 · Verify
- owes: four gates, cheapest first, each with a distinct failure it alone catches
- prevents: spending a consensus review on something a parse would have caught

| # | gate | cost | catches |
|---|---|---|---|
| 1 | **mechanical** | milliseconds, 0 tokens | a parse, a count, a path check, a set difference: `bb scan`, `bb designlabs check`, `anti-slop`, the contract self-test |
| 2 | **semantic** | one gate command | does it do the thing: `npm test`, the acceptance command |
| 3 | **runtime** | a browser or a running app | does it do the thing *where the user is*: Reticle, `designlabs/selftest/states.html` |
| 4 | **consensus** | a model, repeatedly | is it right: Caliper at `--k 3` |

Run them in that order and each gate only sees what survived the one before it.
Invert the order and the expensive gate spends its budget on failures the cheap
gate would have named in twelve milliseconds.

**What each one alone can catch:**

- Mechanical alone: a contrast ratio of 3.1:1, a 900ms transition, a state
  declared and never listed, a palette that is the framework's.
- Runtime alone: a state that is *declared, listed, and renders identically to
  rest*. No parse can see this. It is the most common lie a design system tells
  about itself, and it needs something that looks at pixels.
- Consensus alone: whether the thing is any good. One successful run is an
  anecdote; `--k 3` with a reported `pass^k` is a measurement.

**Write into the prompt:** which of the four this lane must pass, the command
for each, and the sentence that says `unproven` is a state — not a pass.
