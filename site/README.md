# The blinken site

The docs site, live at michaelbaker.tech/blinken/: Get started, a page per concept with live signs,
a gallery playing every built-in, and the API reference generated from the doc comments in
`../src`. The lab is built into it, its pages keeping the URLs they had (`compose.html` and the rest).
It is the blits site's setup (`../../blits/site`), cut down: no explainers, no playground.

```
npm run site         # from the repo root: Astro's dev server on :: port 4886 (no lab, no search)
npm run site:build   # the lab, then the site, then the lab copied in, to site/dist
npm run site:smoke   # build, then load every page headless; fails on a console error, a dead link, a page wider than a phone, or no search index
```

`BLINKEN_SITE_BASE` sets the base path (`/blinken/` on Pages), `BLINKEN_SITE_URL` the origin, and
`BLINKEN_SITE_OUT` the output directory. `site/dist` and `site/.generated` are rewritten whole on each build.

## How a page is made

A page is MDX in `src/pages/` with `layout: ../layouts/Page.astro`, in the order `src/nav.ts` gives.
Code on a page is never pasted into the MDX: `src/live/*.ts` exports `run(root)`, which draws into
`root` and returns what stops it; `<Live client:only="react" of="x.ts" />` runs one while it is on
screen, and `<Listing of="live/x.ts" />` shows it, leaving out the lines above `// ---`. Live files
build their signs in `src/live/kit.ts`'s `stage`, and pause through `held` or `onHold`.

## The reference

`npm run api` runs TypeDoc over `../src/index.ts` into `.generated/api.json`, and `src/api/` prints
it. Each export is filed on the concept page for its source module (`FILED` in
`src/api/entries.ts`; `MOVED` files single exports elsewhere, and a `@category` tag overrides
both), and the build fails on an export that lands on no page. A code span in page prose that names
an export links to its entry. TypeDoc needs TypeScript 6's compiler API, so the site pins it while
the package builds with 7. Types the API uses without exporting are listed in `typedoc.json`.
