# 03 · Contracts
- owes: every shape that crosses a boundary, with the field that makes it stable
- prevents: two stages that agree in prose and disagree in JSON

The contract is the only thing two stages share. Write the shapes before the
code, and for each one name the field that is **stable across runs** — the key.

```js
Finding { id, detector, severity, precision, title, path, files[], key,
          detail, evidence{}, fix_hint, auto_fix, kind, est_tokens, status }
Unit    { id, kind, title, finding_ids[], scope[], anchors[], brief,
          acceptance, est_tokens, projected, verdict, model, status }
Lane    { id, run_id, unit_ids[], files[], cwd, wave, agent, model, status, rc }
```

Three rules:

1. **`key` is not `id`.** The id is derived; the key is what the id is derived
   *from*, and it must be stable across runs. `path + symbol` is a key. A line
   number is not: the same problem gets a new id every time the file moves by
   one line, and the store forgets it was ever seen.
2. **Evidence is structured, not prose.** `{"counts":{"framework":11,"own":1}}`
   survives a diff. "mostly framework colours" does not.
3. **A field that is sometimes absent is a field with a third value.** Say
   whether the third value is `null` (we looked, there is nothing) or missing
   (we did not look). These are different and conflating them is how a report
   starts printing green for things nobody checked.

**Write into the prompt:** every shape, with the key named, and the meaning of
absence for each optional field.
