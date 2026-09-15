# 06 · Lanes
- owes: a cut of the work where every piece fits one window with room to think
- prevents: a session that compacts at 78% and forgets its own brief

The budget model, and the only equation in this pack:

```
projected = overhead + brief + payload × churn + reserve
```

- **overhead** is probed, not assumed. It is what a session costs before any
  work: system prompt, tool definitions, instruction files, MCP schemas.
- **brief** is the packed unit: evidence, regions, scope, acceptance.
- **payload** is the located region plus a widening allowance (0.45 of the rest
  of the file) when a symbol is named rather than a whole file.
- **churn** is the term everyone forgets. A file a session opens gets read,
  often edited, sometimes re-read. Measured near **2.4**.
- **reserve** is held back for the model's own output, per kind of unit.

The verdict is `FITS`, `TIGHT`, `SPLIT` or `HEAVY`. A split respects directory
locality, because two units in the same directory share a cache prefix and two
units in different directories share nothing.

**Five levers, in measured order of effect:**
1. the lean flag stack (44.3k → 29.2k opening window, measured)
2. region, not file
3. say it once — hoist what every finding in a unit shares
4. a cache-stable prefix — byte-identical headers across lanes
5. a compression proxy on the wire, reported on its own row

**Write into the prompt:** this lane's projected total with each term shown
separately, and the verdict.
