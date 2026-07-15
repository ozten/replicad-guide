---
date: 2026-07-14
topic: replicad-api-inventory
purpose: Grounded seed inventory for the replicad quick-reference guide
source: ../replicad/packages/replicad/src (public API) and ../replicad/packages/replicad-docs (docs)
status: seed — verify completeness against the full export list before publishing
---

# Replicad API Inventory (seed)

Grounded inventory of replicad's public API, produced from a source read of
`../replicad/packages/replicad/src` and the docs at
`../replicad/packages/replicad-docs`. It seeds the content and ordering of the
quick-reference guide (see `docs/brainstorms/2026-07-14-replicad-quick-reference-requirements.md`).

**Completeness caveat:** this covers the API surface a user actually reaches
(essentials through most obscure). The full set of named exports from `index.ts`
is larger (on the order of 250+ once wildcard re-exports are counted). Before the
v1.1 full reference, regenerate the complete export list from the TypeScript
source / TypeDoc JSON and reconcile against this inventory — do not treat this as
the exhaustive list.

**Commonness legend:** `ESSENTIAL` (nearly every model uses it) · `COMMON` ·
`OBSCURE` (rarely needed; hide/deemphasize in quick refs).

**API note:** the modern path is `draw()` → `Drawing` → `sketchOnPlane()` →
`Sketch` → 3D `Shape`. The older `Sketcher` (3D world-coordinate) API produces
`Sketch` objects directly and is treated as legacy — full reference only.

---

## Terminology (as replicad uses it)

| Term | Definition | Obtain via |
|---|---|---|
| **DrawingPen** | Fluent 2D path builder. You never `new DrawingPen()`. | `draw()` |
| **Drawing** | Finished, immutable 2D shape (closed or open). Has 2D ops + the bridge to 3D. | `pen.close()` / `pen.done()`, or a canned `drawX()` |
| **Blueprint** | Plane-agnostic 2D shape (set of 2D curves), reusable across planes. Lower-level; `Drawing` is the modern face. | `new BlueprintSketcher()`, or internally from drawings |
| **Sketch** | A 2D profile placed on a plane in 3D (a wire in 3D). Input to depth ops. **Sketch operations consume (delete) the sketch.** | `drawing.sketchOnPlane(...)`, canned `sketchX()`, or `new Sketcher(...)` |
| **Shape / Shape3D** | 3D geometry (Solid, Shell, Face, Edge, Wire, Vertex, Compound). | `sketch.extrude()/revolve()/loftWith()`, `makeX()` primitives |
| **Plane** | Reference frame (origin + normal + 2D axes) a sketch sits on. | `makePlane("XY", offset)`, or a `PlaneName` string |
| **Finder** | Selector (`EdgeFinder`, `FaceFinder`, `CornerFinder`) to pick edges/faces/corners for fillet/chamfer/shell. | `new EdgeFinder()` / `new FaceFinder()` |

---

## 1. 2D — drawing (sketching)

### 1.1 Start a drawing

| API | Signature | Notes | Commonness |
|---|---|---|---|
| `draw` | `draw(initialPoint?: Point2D = [0,0]): DrawingPen` | Entry point to the fluent pen. | ESSENTIAL |

### 1.2 Canned 2D shapes (return a `Drawing` directly)

| API | Signature | Commonness |
|---|---|---|
| `drawCircle` | `drawCircle(radius: number): Drawing` | ESSENTIAL |
| `drawRectangle` | `drawRectangle(width: number, height: number): Drawing` | ESSENTIAL |
| `drawRoundedRectangle` | `drawRoundedRectangle(width, height, r?: number \| {rx?, ry?}): Drawing` | COMMON |
| `drawEllipse` | `drawEllipse(majorRadius: number, minorRadius: number): Drawing` | COMMON |
| `drawPolysides` | `drawPolysides(radius: number, sidesCount: number, sagitta?: number): Drawing` | COMMON |
| `drawText` | `drawText(text: string, config?: {startX?, startY?, fontSize?, fontFamily?}): Drawing` | COMMON |
| `drawSingleCircle` / `drawSingleEllipse` | circle/ellipse as a single curve | OBSCURE |
| `drawParametricFunction` | `drawParametricFunction(fn: (t) => Point2D, {start?, stop?}, approximationConfig?): Drawing` | OBSCURE |
| `drawPointsInterpolation` / `drawFaceOutline` / `drawProjection`-related helpers | interpolation / projection helpers | OBSCURE |

### 1.3 The fluent pen (`DrawingPen` methods, chainable)

Movement & lines (ESSENTIAL/COMMON):
`movePointerTo([x,y])`, `lineTo([x,y])`, `line(dx,dy)`, `hLine(d)`, `vLine(d)`,
`hLineTo(x)`, `vLineTo(y)`, `polarLine(distance, angle)`, `polarLineTo([r,theta])`,
`tangentLine(distance)` (OBSCURE).

Arcs (COMMON) — most have absolute (`…To`) and relative forms:
- three-point: `threePointsArcTo(end, via)`, `threePointsArc(dx,dy,viaDx,viaDy)`
- tangent: `tangentArcTo(end)`, `tangentArc(dx,dy)`
- sagitta (chord + height): `sagittaArcTo(end, sagitta)`, `sagittaArc(dx,dy,sag)`, `vSagittaArc(d,sag)`, `hSagittaArc(d,sag)`
- bulge (DXF-style; 1 = semicircle): `bulgeArcTo(end, bulge)`, `bulgeArc(dx,dy,b)`, `vBulgeArc(d,b)`, `hBulgeArc(d,b)`
- elliptical: `ellipseTo(end, rx, ry, rot=0, longAxis=false, sweep=false)`, `ellipse(...)`, `halfEllipseTo(end, ry, sweep=false)`, `halfEllipse(...)`

Curves (COMMON):
`bezierCurveTo(end, controlPoints)`, `quadraticBezierCurveTo(end, cp)`,
`cubicBezierCurveTo(end, startCP, endCP)`, `smoothSplineTo(end, config?: SplineConfig)`,
`smoothSpline(dx, dy, config?)`.

Corner modifier: `customCorner(radius, mode?: "fillet"|"chamfer")` (COMMON).

Finish (ESSENTIAL): `close(): Drawing`, `done(): Drawing`,
`closeWithMirror(): Drawing` (COMMON), `closeWithCustomCorner(...)` (OBSCURE).

### 1.4 Operations on a finished `Drawing`

Transforms (ESSENTIAL/COMMON): `translate(dx,dy)` / `translate([x,y])`, `rotate(angle, center?=[0,0])`,
`mirror(centerOrDirection?, origin?, mode?)`, `scale(factor, center?)`, `stretch(...)` (OBSCURE),
`clone()`.

2D booleans (COMMON): `fuse(other)`, `cut(other)`, `intersect(other)`.

Corners (COMMON): `fillet(radius, filter?: (c: CornerFinder)=>CornerFinder)`,
`chamfer(radius, filter?)`.

Offset (COMMON): `offset(distance, opts?: {lineJoinType?})`.

Bridge to 3D (ESSENTIAL): `sketchOnPlane(plane?, origin?)`, `sketchOnFace(face, scaleMode?)`,
`punchHole(...)` (OBSCURE).

Query/export (COMMON/OBSCURE): `boundingBox`, `toSVG(opts?)`, `toSVGViewBox()`,
`toSVGPaths()`, `serialize()` / `deserializeDrawing()`.

Helpers: `CornerFinder` (select corners for `Drawing.fillet/chamfer`), `Point2D`
utilities from `lib2d` (`distance2d`, `polarToCartesian`, `rotate2d`, `axis2d`, …) — OBSCURE.

---

## 2. 2D → 3D bridge

- `Drawing.sketchOnPlane(plane?: Plane | PlaneName, origin?: Point | number): Sketch` — ESSENTIAL. Lift a 2D drawing onto a plane.
- `Drawing.sketchOnFace(face: Face, scaleMode?: ScaleMode): Sketch` — COMMON. Map a drawing onto a 3D face.
- `makePlane(plane: Plane | PlaneName = "XY", origin: Point | number = [0,0,0]): Plane` — ESSENTIAL.
- **Named planes:** `"XY" | "YZ" | "ZX" | "XZ" | "YX" | "ZY" | "front" | "back" | "left" | "right" | "top" | "bottom"`. Origin as a number offsets along the normal.
- `Plane` methods: `clone()`, `translateTo(pt)`, `translate(...)`, `translateX/Y/Z(d)`, `pivot(angle, dir?)`, `rotate2DAxes(angle)`, `toWorldCoords([x,y])`, `toLocalCoords(vec)` — COMMON/OBSCURE.
- Legacy: `new Sketcher(plane?, origin?)` — the 3D-world-coordinate sketcher; same pen-style methods, `.done()`/`.close()`/`.closeWithMirror()` return a `Sketch`. Legacy — full reference only.
- Canned sketches (skip the pen): `sketchCircle`, `sketchEllipse`, `sketchRectangle`, `sketchRoundedRectangle`, `sketchPolysides` — COMMON; `sketchFaceOffset`, `sketchParametricFunction`, `sketchHelix`, `polysideInnerRadius` — OBSCURE.

---

## 3. 3D — making solids from a sketch

All `Sketch` methods **consume the sketch**.

- `Sketch.extrude(distance, { extrusionDirection?, extrusionProfile?, twistAngle?, origin? } = {}): Shape3D` — ESSENTIAL. `extrusionProfile: { profile?: "s-curve"|"linear", endFactor? }` tapers; `twistAngle` twists.
- `Sketch.revolve(axis?: Point, { origin?, angle? } = {}): Shape3D` — ESSENTIAL. Angle degrees, default 360.
- `Sketch.loftWith(other: Sketch | Sketch[], { ruled?, startPoint?, endPoint? } = {}, returnShell?): Shape3D` — COMMON.
- `Sketch.sweepSketch((plane, origin) => Sketch, sweepConfig?: GenericSweepConfig): Shape3D` — COMMON. Config: `frenet?`, `auxiliarySpine?`, `law?`, `transitionMode?: "right"|"transformed"|"round"`, `withContact?`, `support?`.
- `Sketch.face(): Face` — COMMON; `Sketch.wires()/faces()` — OBSCURE.

### 3.1 Primitive solids (`shapeHelpers` / `shortcuts`)

- `makeBaseBox(xLength, yLength, zLength): Shape3D` — COMMON (centered box).
- `makeBox(corner1: Point, corner2: Point): Solid` — ESSENTIAL.
- `makeCylinder(radius, height, location? = [0,0,0], direction? = [0,0,1]): Solid` — ESSENTIAL.
- `makeSphere(radius): Solid` — ESSENTIAL; `makeEllipsoid(a, b, c): Solid` — COMMON.

### 3.2 Edge / wire / face primitives (mostly COMMON, some OBSCURE)

`makeLine(v1,v2)`, `makeCircle(r, center?, normal?)`, `makeEllipse(...)`,
`makeThreePointArc(v1,v2,v3)`, `makeTangentArc(start, tgt, end)`, `makeEllipseArc(...)`,
`makeBezierCurve(points)`, `makeBSplineApproximation(points, config?)` (OBSCURE),
`makeHelix(pitch, height, radius, center?, dir?, lefthand?)` (OBSCURE),
`assembleWire(edges)`, `makeFace(wire, holes?)`, `makePolygon(points)`,
`makeNonPlanarFace(wire)` (OBSCURE), `makeVertex(point)` (OBSCURE),
`makeSolid(facesOrShells)`, `makeOffset(face, offset, tol?)`,
`compoundShapes(shapes)` / `makeCompound(shapes)`.

---

## 4. 3D — combining and modifying

### 4.1 Booleans (methods on `Shape3D`; immutable — return new shapes)

- `fuse(other, { optimisation?: "none"|"commonFace"|"sameFace" } = {}): Shape3D` — ESSENTIAL (union).
- `cut(tool, { optimisation? } = {}): Shape3D` — ESSENTIAL (difference).
- `intersect(tool): Shape3D` — COMMON.

### 4.2 Modifications (use finders to pick edges/faces)

- `fillet(radiusConfig, filter?: (e: EdgeFinder) => EdgeFinder): Shape3D` — ESSENTIAL. `radiusConfig`: number | `[r1,r2]` (variable) | `(edge) => number|null` | `{ filter, radius, keep? }`.
- `chamfer(radiusConfig, filter?): Shape3D` — COMMON. number | `{ distances:[a,b], selectedFace }` | `{ distance, angle, selectedFace }` | fn | `{ filter, radius, keep? }`.
- `shell(thickness, finder: (f: FaceFinder)=>FaceFinder, tol?): Shape3D` (or `shell({filter, thickness}, tol?)`) — COMMON. Negative = inward walls.
- `draft(angle, faceFinder, neutralPlane?): Shape3D` — OBSCURE (mould draft).

### 4.3 Transforms (methods on any `Shape`)

`translate(dx,dy,dz)` / `translate(vec)` — ESSENTIAL; `translateX/Y/Z(d)` — COMMON;
`rotate(angle, position?=[0,0,0], direction?=[0,0,1])` — ESSENTIAL;
`mirror(plane?, origin?)` — COMMON; `scale(factor, center?=[0,0,0])` — COMMON; `clone()`.
Free-function variants exist in `geomHelpers` (OBSCURE).

---

## 5. Selecting features — Finders

`new EdgeFinder()`, `new FaceFinder()`, `new CornerFinder()` (2D). Chainable filters
(AND by chaining; OR via `either([...])`; negate via `not(...)`): `inPlane(plane, offset?)`,
`ofSurfaceType(...)` / `ofCurveType(...)`, `inDirection(dir)`, `containsPoint(pt)`,
`inList(...)`, `atDistance(...)`, `inBox(...)`, and more. Used by `fillet`/`chamfer`/`shell`/`draft`.
Enumerate the full filter set from `finders/` for the reference.

---

## 6. Inspection & export

Shape queries (COMMON/OBSCURE): `.edges`, `.faces`, `.wires`, `.boundingBox`,
`.clone()`, `.isSame(other)`, `.isEqual(other)`, `.hashCode`.
Face: `pointOnSurface(u,v)`, `normalAt(pt?)`, `center`, `outerWire()`, `innerWires()`,
`UVBounds`, `geomType`, `orientation`, `flipOrientation()`.
Edge: `startPoint`, `endPoint`, `pointAt(t?)`, `tangentAt(t?)`, `length`, `geomType`,
`isClosed`, `isPeriodic`.

Meshing/export (COMMON): `mesh({ tolerance?, angularTolerance? })`, `meshEdges(...)`,
`blobSTEP()`, `blobSTL({ tolerance?, angularTolerance?, binary? })`,
`serialize()` / `deserializeShape(data)`. Projection to 2D for drawings:
`drawProjection(...)` / `ProjectionCamera` (used for the guide's static 3D visuals).

---

## 7. Current docs — what's good, what's weak

**Docs live in** `../replicad/packages/replicad-docs/docs/`: `intro.md`,
`use-as-a-library.md`, `other-resources.md`; `tutorial-overview/`;
`tutorial-making-a-watering-can/`; `advanced-topics/`; `recipes/`; `examples/`.
The API reference is **auto-generated TypeDoc** (via `docusaurus-plugin-typedoc`),
built from `index.ts` — not committed, generated at build.

**Tutorial (excellent) teaching order:** workbench → 2D drawing → planes & sketches
→ adding depth (extrude/revolve/loft) → transformations → combinations (booleans)
→ modifications (fillet/chamfer/shell) → finders → sharing/parametric models.
Hands-on, progressive, consistent vocabulary, "open in workbench" buttons.

**Why the reference is weak (the problem this guide fixes):**
1. Flat, alphabetical TypeDoc dump — no conceptual grouping (2D vs 3D).
2. No sense of common vs. obscure.
3. No entry points — e.g. `DrawingPen` is listed with no hint that you get it from `draw()`.
4. No inline examples (how to draw a half circle, rotate a shape…).
5. Click-through required to see each function's arguments.
6. No high-level "map of everything," no glossary of Drawing/Sketch/Shape/Blueprint.

**Topic checklist the guide must cover:** 2D drawing (pen + canned shapes + Drawing
ops incl. offset/2D-booleans/corners), planes & sketchOnPlane/sketchOnFace, depth
(extrude/revolve/loft/sweep), transforms, booleans, modifications
(fillet/chamfer/shell + draft), finders (edge/face/corner + full filter taxonomy),
text, projections, primitives, inspection, export/serialization, parametric models.
