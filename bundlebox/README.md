# bundlebox landing

The public page for [bundlebox](https://github.com/blackswanalpha/bundlebox) — Next.js
App Router, static output, deployed on Vercel.

## What is on it

Every number and every claim is quoted from the repository it describes, at
`v0.5.0`: `README.md` for the measured pairs and the agent table, `docs/index.html`
for the console's routes. `app/content.js` holds all of it in one place, so the
page is re-derived when the repository moves rather than re-argued. Nothing on
the page is a projection, and nothing is an average across units.

The performance profile under the hero — `components/Profile.js` — draws each row
against the larger number **in its own row, in its own unit**. There is no index
and no score: tokens are compared to tokens, seconds to seconds. A side that is
genuinely zero gets a tick at the origin rather than an empty track, because
"none" is the measurement.

## The marks

`public/logo.svg` and `public/logo-wordmark.svg` are pulled from GitHub, not
copied from a checkout:

```bash
npm run assets          # main, checked against the v0.5.0 release asset
npm run assets v0.4.0   # against a different tag
```

`scripts/pull-assets.sh` fetches both files from `main` and compares `logo.svg`
against the release asset of the given tag. If they differ it exits non-zero
rather than picking one, because that means the page is being built against a
mark the release does not carry.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static prerender
npm run start    # serve the build
npm run lint
```

No Tailwind and no UI library: one stylesheet in `app/globals.css`, with the
palette taken from the mark's own gradient stops so the logo sits in its own
light. The type is Helvetica, with the metric-compatible fallbacks.

## Deploying

Vercel builds it with zero configuration — `next build`, static output, no
runtime. `next.config.mjs` sets the security headers on the deployed build only;
the dev server needs `eval` for React's callstacks and a websocket for HMR, and a
header tight enough to ship stops it hydrating at all.

```bash
vercel          # preview
vercel --prod   # production
```
