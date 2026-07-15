---
date: 2026-07-15
topics: [replicad, wasm, node, rendering, projection]
context: v1 build of the quick-reference pipeline (U1–U7)
---

# Build-time rendering gotchas (replicad WASM in Node)

Gotchas hit while building the v1 render pipeline, kept so they don't get
re-discovered.

## drawProjection fails on smooth-surface-only compounds

`drawProjection` (and therefore our 3D projection SVGs) throws
`Unexpected numItems value: 0` (from flatbush, during curve stitching) when
the shape has no stitchable edges — e.g. the fuse of two spheres. Prefer
shapes with at least one edged face in projection examples; boxes/cylinders
are always safe.

## The replicad monorepo must be installed under Node 20

`@parcel/watcher@2.0.4` (transitive dev dep in the monorepo) fails its
node-gyp build against Node 24's N-API headers (`node-addon-api@3.2.1` is
too old). `pnpm run setup` works under the pinned `.nvmrc` Node 20.12.1;
under Node 24 it fails mid-install and leaves `vite` missing.

## manifold-3d version must match the monorepo lockfile, not its range

`replicad-cli` declares `manifold-3d: ^3.0.1` but imports
`manifold-3d/lib/wasm.js`, which only exists in later 3.x releases. The
monorepo lockfile resolves to **3.3.2** — pin exactly that in the guide.
The plain `3.0.1` release has no `lib/` directory at all.

## The evaluator signals failure by return value, never exceptions

`buildShapesFromCode` returns `{error, message, stack}` on failure, and
per-shape mesh errors are swallowed onto entries (`entry.error === true`)
while staying in the result array. Silent-drop also exists: entries whose
shape is neither SVGable nor meshable are filtered out without a trace.
Always check: non-array result, empty array, `entry.error`, and empty
`paths` — see `assertValidBuildResult` in `src/lib/render-engine.ts`.

## `--expose-gc` is an opt-in trap

The render engine nudges `globalThis.gc()` every 10 examples because OCCT
objects are freed only via FinalizationRegistry and the WASM heap grows
monotonically. Without `node --expose-gc` the nudge is a silent no-op — the
`render`/`check:examples` package scripts pass the flag, but any ad-hoc
invocation (plain `tsx scripts/...`) quietly loses the protection. Fine at
v1 scale (dozens of examples); an OOM risk at v1.1 scale (250+).

## Rendering is serial by design — do not parallelize casually

One evaluator, one `shapesMemory`, one shared OC virtual FS: examples must
render strictly sequentially in one process. Worker-pool sharding (v1.1
lever) is safe only with one evaluator **per worker process**, never
concurrent renders against a shared evaluator.

## HLR projection SVGs are not byte-deterministic across render orders

OCCT's hidden-line removal iterates pointer-keyed structures, so the path
*segmentation* of a projection SVG depends on the heap layout left behind by
previously rendered examples (observed on the `shell` example: 37 paths in
both orders, same vertices, different grouping — visually identical). Solo
re-renders in fresh processes ARE byte-identical; only the predecessors
change the outcome. Consequences: the shuffled-order leakage check
(`scripts/check-order.ts`) compares 2D visuals byte-exact but 3D projections
by a geometry fingerprint (viewbox + deduplicated numeric set of the path
data), and a cached 3D SVG may legitimately differ in bytes from what a
fresh render would emit.

## Projection shapes come from shapesMemory, not the result array

The rendered result carries only mesh data. The real shape objects live in
the evaluator's `shapesMemory` singleton, index-aligned with the result.
On a FAILED build the memory still holds the previous example's shapes —
only read `getShapeEntries()` immediately after a validated successful
`buildShapesFromCode` of the same example.
