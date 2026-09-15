# demo

A small real service and the UI in front of it. It exists so bundlebox has an
honest thing to scan, compile, route and run against, and so the numbers in
`bb session` come off a real tree rather than a fixture.

    npm test          six tests over the domain
    npm start         http://localhost:8420

Two surfaces, matching the scenarios already in `.bundlebox/cookbook/demo/`:

| surface | why |
|---|---|
| `/health` | is it up at all |
| `/items` | the thing the product is about |

`web/` is deliberately the generic version — the framework palette, one radius,
one shadow, emoji for icons, no `:focus-visible`. `bb scan` finds all of it, and
`../designlabs/` is the same product after those decisions were actually made.
