# 05 · Gates
- owes: one command per scope whose exit code is the verdict
- prevents: work that is reviewed instead of proven

A gate is a command, not a description. It has a scope, a timeout and an exit
code, and nothing else is needed to know whether a unit is done.

```json
{ "demo": { "quick": "npm test", "full": "npm run lint && npm test" },
  ".":    { "quick": "node designlabs/selftest/contract.mjs designlabs" } }
```

Three rules:

1. **A unit with no gate is `unproven`, never `passed`.** Skipped is not green.
   This is the single rule that keeps a report honest, and it is the first one
   dropped under deadline.
2. **Cap the gate's output.** A failing analyzer is four thousand lines, and a
   session that reads all of them has spent the unit's budget learning it failed.
   Head and tail; the middle of a stack trace has never helped anyone.
3. **`quick` runs per unit, `full` runs per wave.** If `quick` takes longer than
   the edit it proves, it is not a quick gate, it is the whole build wearing one.

**Write into the prompt:** the gate command for the scope this lane touches, and
what its failure output looks like when it is the interesting kind of failure.
