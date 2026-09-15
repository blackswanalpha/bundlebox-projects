# 09 · Evolve
- owes: a loop with a stopping condition that is not a turn count
- prevents: a build that converges on the prompt instead of on the problem

Five phases, taken from Ouroboros (`bb designlabs sources --kind tooling`):

1. **Interview** — Socratic questions that surface the assumptions the brief
   hid. Score the ambiguity; a spec written over an unscored ambiguity is a
   spec that will be rewritten.
2. **Seed** — the answers crystallise into an **immutable** specification. The
   immutability is the point: a spec that drifts during execution cannot be the
   thing execution is measured against.
3. **Execute** — decompose, then build. Discover → Define → Design → Deliver.
4. **Evaluate** — the gate stack in pattern 10, cheapest first.
5. **Evolve** — reflect, and feed what was learned into the next seed.

**The stopping condition.** Not "ten turns" and not "looks done". Stop when the
specification stops changing — when the next interview returns the same ontology
as the last one. Ouroboros calls it convergence and puts it near 95% schema
similarity. Detect stagnation too: answers that stop changing because the loop
has run out of ideas look identical, from inside, to answers that stop changing
because they are right. The difference is whether the gates are passing.

**Write into the prompt:** which phase this lane is, what its seed is, and the
condition under which it stops rather than a turn budget.
