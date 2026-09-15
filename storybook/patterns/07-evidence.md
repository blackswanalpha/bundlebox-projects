# 07 · Evidence
- owes: the finding, not the instruction to go and find it
- prevents: paying for the same search twice

A session that has to discover what is wrong pays twice: once for the tool
results it reads, and once for the context those results occupy for the rest of
the run. The second cost is the larger one and it is invisible on the bill.

So the prompt carries the answer:

> `demo/web/styles.css:7` — the palette is the framework's: 11 default ramp
> values (`#6366f1`, `#8b5cf6`, `#3b82f6`, …) against 1 of your own (`#ffffff`).

not

> Check whether the colours look generic.

Four rules:

1. **Evidence, not pointers.** "table X is missing key Y" beats "check the
   tables" by about the cost of reading two thousand-line files.
2. **Say it once.** Eight findings from one detector in one directory share a
   file, a procedure and most of their evidence. Hoist the shared part into a
   header; leave only the row that differs.
3. **Never say it twice.** If the detail already rendered a row, the structured
   evidence must not repeat it. Measured at 16% of one brief before it was
   fixed — in the tool whose entire job is not to waste tokens.
4. **Region, not file.** Carry the lines inline with their numbers, so the
   common case is a session that never opens the file at all.

**Write into the prompt:** every finding with file, line, quoted region and the
counts behind it — and nothing the session would have to verify.
