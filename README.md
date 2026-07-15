# replicad-guide

A better quick reference and guide to [replicad](https://replicad.xyz) — the
code-first CAD library. Three pages: a **2D quick reference** (sketching), a
**3D quick reference** (making + manipulating solids), and a **full API
reference** (v1.1). Every entry shows how to obtain the object, inline
examples of common uses, the full call signature, and a visual **rendered at
build time from the exact example code shown** — so visuals can never drift
from the code.

## Setup

Requires Node 20 (see `.nvmrc`) and pnpm (via corepack).

```bash
git submodule update --init   # pinned replicad monorepo checkout (vendor/replicad)
pnpm run setup                # install + build the replicad packages we consume
pnpm install                  # guide dependencies
```

The guide consumes the replicad **monorepo source** (not npm packages) via the
`vendor/replicad` submodule, pinned to a specific ref. That ref is the single
version everything is generated against; it is surfaced on the site by the
version badge and recorded in `src/lib/replicad-version.ts`.

## Build (two steps)

```bash
pnpm run render   # step 1: node --expose-gc boots the OpenCascade WASM once,
                  #         runs every example, writes SVGs + data to generated/
pnpm run build    # runs step 1, then `astro build` (consumes generated/ only —
                  #         Astro never boots the evaluator)
```

## How examples work (no drift)

Each example is authored **once** as a record `{ id, code, title, group,
commonness }` under `src/examples/`. The same `code` string is:

1. displayed on the page (lossless — what you read is the record),
2. executed at build time to produce the SVG visual,
3. encoded into the example's "open in studio" deep-link.

There is no second copy, so the visual cannot drift from the code. CI re-runs
every example against the pinned replicad ref and fails loudly when one breaks.

## Bumping the pinned replicad version

1. Update the `vendor/replicad` submodule to the new ref.
2. Update `src/lib/replicad-version.ts` to match.
3. CI re-renders every example and regenerates signatures — anything that
   breaks fails the build, naming the example.
