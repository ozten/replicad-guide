# replicad-guide

A better quick reference and guide to [replicad](https://replicad.xyz) — the
code-first CAD library. Three pages: a **2D quick reference** (sketching), a
**3D quick reference** (making + manipulating solids), and a **full API
reference** (every public export, grouped by concept, with signatures
generated from the pinned source). Every entry shows how to obtain the
object, inline examples of common uses, the full call signature, and a
visual **rendered at build time from the exact example code shown** — so
visuals can never drift from the code. A site-wide search box covers all
symbols, class members, and quick-ref entries.

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
pnpm run render        # step 1a: node --expose-gc boots the OpenCascade WASM once,
                       #          runs every example, writes SVGs + data to generated/
pnpm run generate:api  # step 1b: pinned typedoc against vendor source →
                       #          generated/api.json (the full-reference model)
pnpm run build         # runs both, then `astro build` (consumes generated/ only —
                       #          Astro never boots the evaluator)
```

The render step keeps an incremental cache: entries whose code, pinned ref,
and render options are unchanged are reused from the previous manifest
(`--force` re-renders everything). Above 100 examples the run recycles child
processes to cap WASM-heap growth. Two extra gates exist for the pipeline
itself: `pnpm run check:order` (output must not depend on render order) and
`pnpm run check:scale` (300 synthetic examples within the memory budget).

## The full API reference

`scripts/generate-api.ts` runs the exact-pinned `typedoc` against the
checkout's `src/index.ts` and normalizes the JSON into concept-grouped
entries (`src/lib/api-model.ts`). What the source can't provide lives in the
curated overlay `src/reference/curation.ts`: group assignment per source
file, entry points for factory-obtained classes, and which quick-ref
examples a geometry entry embeds. Reconciliation is two-way and loud — a
new upstream file fails the build until mapped, and a curated symbol that
disappears upstream fails too.

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
