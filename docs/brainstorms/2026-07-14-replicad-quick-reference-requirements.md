---
date: 2026-07-14
topic: replicad-quick-reference
---

# Replicad Quick Reference & API Guide

## Problem Frame

Replicad's tutorial is excellent, but its reference material is not usable for
day-to-day lookup. The API reference is auto-generated TypeDoc: a flat,
alphabetical dump with no conceptual grouping, no sense of what is common vs.
obscure, and no inline examples. Concrete failures a user hits today:

- **No entry points.** A page like `DrawingPen` lists methods but never says how
  you obtain one — you never `new DrawingPen()`, you call `draw()`. The reference
  gives you the class in isolation, so it's unusable without prior knowledge.
- **No usage examples.** `drawCircle` shows it takes a radius, but not how to
  draw a half circle, or how to rotate the circle after drawing it. The answers
  exist in the API but are undiscoverable from the function's own page.
- **2D and 3D are not separated**, and there is no scannable high-level map of
  "everything you can do."
- **Hunt-and-peck.** Seeing an operation's arguments and docs requires clicking
  into each function individually.

The audience is someone who has done (or skimmed) the tutorial and now needs fast
recall and lookup — not a from-scratch learner. The guide **complements** the
tutorial; it does not replace it.

### Core mental model the guide is built around

Every entry must make this object flow obvious — where an object comes from, what
you can do with it, and how you cross from 2D into 3D. This flow also maps
directly onto the three pages.

```
   2D quick reference        │  2D → 3D bridge   │   3D quick reference
   (sketching)               │  (top of 3D page) │   (making + manipulating)
─────────────────────────────┼───────────────────┼──────────────────────────
 draw()                      │                   │
   → DrawingPen  (the pen)   │                   │
   .lineTo/.arc/.halfEllipse │                   │
   .close() / .done()        │                   │
       → Drawing (2D shape)  │                   │
         .rotate/.mirror     │                   │
         .offset             │                   │
         .fuse/.cut (2D)     │                   │
         .sketchOnPlane("XZ")┼──→ Sketch ────────┼──→ .extrude(h)
                             │   (2D on a plane) │    .revolve() / .loftWith()
 or canned shapes:           │                   │        → Shape (Solid)
   drawCircle/drawRectangle  │                   │          .fuse/.cut/.intersect
   drawRoundedRectangle      │                   │          .fillet/.chamfer/.shell
   drawPolysides/drawText    │                   │          .translate/.rotate/.mirror
                             │                   │          Finders → pick edges/faces
                             │                   │          .blobSTEP() / .blobSTL()
```

## Requirements

**Structure — three pages**

- R1. Ship three distinct pages: **2D quick reference (sketching)**, **3D quick
  reference (making and manipulating 3D)**, and **Full API reference**.
- R2. Place the 2D→3D bridge (`sketchOnPlane`, `sketchOnFace`, named planes,
  `makePlane`) as the opening band of the 3D quick reference, and cross-link to it
  from the end of the 2D page. It is not its own page.
- R3. The 2D and 3D quick references are curated and ordered **most-common →
  least-common**; obscure operations are hidden or barely mentioned, with a
  pointer to the full reference for completeness.

| Page | Covers | Treatment | Ordering |
|---|---|---|---|
| 2D quick ref | `draw()` pen, canned `drawX` shapes, `Drawing` ops (offset, 2D booleans, transforms) | Entry point + example(s) + **SVG** | common → obscure |
| 3D quick ref | Bridge (sketchOnPlane/planes), extrude/revolve/loft, booleans, fillet/chamfer/shell, transforms, finders, export | Entry point + example(s) + **static 3D visual** + open-in-studio link | common → obscure |
| Full API ref | Every public export, logically grouped | Signature + docs for all; example + visual where it clarifies | grouped by concept |

**Entry treatment (what every quick-ref entry contains)**

- R4. Every entry states its **entry point** — how you obtain or call the thing.
  No entry may reference an object (e.g. `DrawingPen`, `Sketch`, `Face`) without
  showing how to get one. This directly fixes the `DrawingPen` failure.
- R5. Every entry shows one or more **inline examples of obvious/common uses**,
  not just the bare signature. Examples should answer the natural follow-up
  questions (e.g. for `drawCircle`: draw a half circle; rotate it after drawing).
- R6. Each entry shows the **full call signature** inline — argument names, types,
  and defaults — so the reader never clicks through to see arguments. Signatures
  are extracted from the TypeScript source / TypeDoc JSON, not hand-authored, so
  they cannot drift from the library.

**Visual rendering**

- R7. 2D examples render to **inline SVG**, generated via replicad's own
  `Drawing.toSVG()` family by running replicad at **build time**. (Generating SVG
  still calls into the OpenCascade WASM — it is not a WASM-free path — but the
  WASM runs only during the build; readers receive static, crisp SVG with no WASM
  shipped for the 2D pages.)
- R8. 3D examples render as a **static visual baked at build time**, plus an
  **"open in studio"** deep-link that opens the exact example live in replicad's
  studio (the tutorial already ships such "Open in workbench" links). The static
  visual is preferably an SVG isometric/orthographic projection via replicad's own
  `drawProjection` / `ProjectionCamera` — fully headless and drift-free, needing
  no in-browser WASM and no headless-WebGL raster step. **No WASM is shipped to
  readers; pages are fully static.**
- R9. **No drift:** every visual is produced from the exact example code shown on
  the page. The displayed code is the source of truth for its illustration.

**Curation, consistency, and the modern API**

- R10. The quick references teach **only the modern `draw()` / `Drawing` API**.
  The legacy `Sketcher` (3D world-coordinate) API is not taught in the quick refs;
  it is noted once, as legacy, in the full reference. (Mixing the two is part of
  what makes the current docs confusing.)
- R11. Use **consistent terminology** matching replicad's own usage —
  DrawingPen, Drawing, Blueprint, Sketch, Shape, Plane, Finder — with a short
  glossary so a reader always knows which object a section is about.
- R12. Link out to the existing tutorial and `use-as-a-library` docs rather than
  re-teaching setup, WASM embedding, or first-principles concepts.

**Full API reference specifics**

- R13. Every public export gets a full signature (all args, types, defaults) plus
  a description, on **scannable grouped pages** (grouped by concept, not
  alphabetical) — nothing requires a click-through to see its arguments.
  Signatures and base descriptions are **auto-generated from source** (TypeScript /
  TypeDoc JSON); concept grouping, curation, and examples are layered on top. The
  full reference ships as a **v1.1 pass, after** the quick-reference pages.
- R14. Geometry-producing entries in the full reference reuse the quick-ref
  treatment (inline example + SVG/3D visual). Trivial utilities (e.g. getters,
  equality checks like `isSame`, `hashCode`) get signature + doc only. Legacy
  `Sketcher` / `FaceSketcher` / `BlueprintSketcher` entries get signature + doc
  (and at most a static example), no interactive visual.

**Freshness and maintenance**

- R15. The guide is pinned to a specific replicad version and shows it on the site
  (e.g. a footer badge). A CI job regenerates signatures from source and runs every
  example against the pinned version, failing when any example stops compiling — so
  drift from replicad is caught loudly, not silently. Bumping the pinned version
  surfaces exactly what changed.

## Success Criteria

- A reader can answer "how do I draw a half circle?" and "how do I rotate a
  drawing?" from the 2D page in seconds, without clicking into anything.
- No quick-ref entry names an object without showing how to obtain it.
- Every 2D geometry entry has a matching inline SVG; every 3D geometry entry has a
  working live viewer — and each is generated from the code shown beside it.
- In the full reference, any public export's full signature + description is
  visible on a scannable page with no click-through to see its arguments.
- The 2D/3D quick refs are demonstrably ordered common → obscure, with obscure
  operations de-emphasized.
- The glossary defines every key term (DrawingPen, Drawing, Blueprint, Sketch,
  Shape, Plane, Finder) so a reader always knows which object a section refers to.
- A version bump that breaks an example fails CI (drift is never silent), and the
  site always states which replicad version it documents.

## Scope Boundaries

- Not a replacement for the tutorial. The tutorial stays authoritative for
  learning; this guide is for lookup and recall and links to it.
- Not a from-scratch teaching resource; assumes tutorial-level orientation.
- Does not re-document integration/hosting/WASM-setup (linked, not duplicated).
- Does not document internal/private APIs.
- All visuals are static and baked at build time (2D SVG, 3D SVG projection).
  Live in-page interactivity (drag-to-rotate, editable snippets) is intentionally
  out of scope — interactivity is delegated to replicad's studio via "open in
  studio" links.

## Key Decisions

- **Three pages, bridge folded into 3D:** matches how the work actually flows
  (sketch → lift onto plane → make solid) and keeps the 2D page purely 2D.
- **All visuals baked at build time; interactivity delegated to studio:** 2D →
  inline SVG (`Drawing.toSVG()`); 3D → a static SVG projection (`drawProjection`),
  with an "open in studio" link for live rotate/edit. No WASM shipped to readers;
  pages stay light and fully static. Chosen over a bespoke in-browser viewer to
  eliminate the largest build and maintenance cost, while keeping interactivity
  available through replicad's existing studio.
- **Examples as source of truth for visuals:** guarantees the illustration always
  matches the API and cannot rot.
- **Modern API only in quick refs:** removes a major source of the current docs'
  confusion.
- **Curate, don't dump:** commonness ordering and hiding obscure ops is the
  central improvement over the auto-generated TypeDoc reference.
- **Full reference = generated signatures + human curation, phased:** extract
  signatures/types/defaults/docs from source so they never drift, then add
  concept-grouping and examples. **v1 = the two curated quick-reference pages;
  v1.1 = the full reference** — ship curation first and validate the format before
  the largest content effort.
- **Standalone guide (not upstream), accepted deliberately:** a richly-formatted
  standalone HTML guide in this repo, rather than contributing the curation to
  replicad's own TypeDoc. Trade-off: it duplicates some coverage and must chase
  upstream releases — mitigated by generating signatures from source (R6/R13) and
  the pin+CI freshness mechanism (R15).
- **Pin + CI + version badge for freshness:** accept standalone's sync burden with
  an automated safety net (re-run examples + regenerate signatures on every bump)
  rather than risking silent staleness.

## Dependencies / Assumptions

- Grounded in the replicad source at `../replicad/packages/replicad/src` and its
  docs at `../replicad/packages/replicad-docs`. An inventory of the 2D API, the
  2D→3D bridge + 3D API, and the current docs' weaknesses was produced during this
  brainstorm's source exploration and committed to
  `docs/reference/replicad-api-inventory.md` as the planning seed. It still needs
  **re-verification for completeness** — the public API surface is substantial
  (well over 150 named exports, on the order of 250+), so regenerate the full
  export list from source during planning rather than trusting an approximation.
- No in-browser WASM or viewer is shipped: all rendering happens at build time.
  replicad's `drawProjection` produces headless SVG for static 3D visuals, and
  "open in studio" links delegate live/interactive viewing to replicad's studio
  (the same mechanism as the tutorial's "Open in workbench" buttons).
- Build-time (Node) rendering is already proven in-repo: `packages/replicad-cli`
  loads the WASM in Node and `projectSvg.ts` renders SVG headlessly — the
  reference implementation for baking 2D SVG (and, if chosen, precomputed 3D data)
  at build time.
- `Drawing.toSVG()` / `toSVGViewBox()` / `toSVGPaths()` exist and are the 2D
  rendering path (verified in source) — note they call into the WASM, so SVG
  generation runs replicad rather than being a WASM-free path.

## Outstanding Questions

### Deferred to Planning

- [Affects R8][Technical/Needs research] How to render the static **3D** visual
  headlessly at build time: replicad's `drawProjection` → SVG (fully headless, no
  WebGL — preferred) versus a headless-WebGL raster of the shaded mesh (not used
  anywhere in-repo today). And confirm the **studio deep-link / URL format** for
  the "open in studio" links (the tutorial's existing "Open in workbench"
  mechanism).
- [Affects R1][Technical] Static-site tooling choice (plain HTML + a bundler like
  Vite, Astro, MDX, etc.) — pick during planning.
- [Affects R9][Technical] The mechanism that makes each example the single source
  of truth for both its rendered code block and its visual (e.g. one examples
  module imported by both).
- [Affects R14][Technical] Exact commonness thresholds and the per-export
  ESSENTIAL/COMMON/OBSCURE tagging that decides ordering and which full-ref
  entries earn a visual.
- [Affects R1][Design] Findability across 250+ entries: site-wide search and
  in-page navigation (TOC / anchors / sticky nav), the canonical per-entry layout
  template, global nav across the three pages, and the granularity of
  quick-ref→full-ref cross-links.
- [Affects R5][Design] Copy-to-clipboard on example code blocks; accessibility
  (text/alt equivalents for the SVG visuals) — feasible since visuals derive from
  the shown code.

## Next Steps

All blocking decisions are resolved. → `/ce:plan` for structured implementation
planning.
