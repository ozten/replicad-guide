/**
 * The curated overlay for the full API reference (U8).
 *
 * TypeDoc supplies signatures and descriptions; this file supplies what the
 * source can't: concept grouping (only ~40 of 199 exports carry @category —
 * the rest would land in "Other"), entry points for factory-obtained classes
 * (R4), and which quick-ref examples a geometry entry embeds (R14).
 *
 * Reconciliation is enforced both ways by buildReferenceModel: an export
 * whose file isn't mapped fails the build (new upstream file on a ref bump),
 * and a curated name that no longer exists fails too (upstream rename).
 * Grouping is seeded per FILE, so new exports in known files land in the
 * right group automatically.
 */
import type { Curation } from "../lib/api-model";

export const referenceCuration: Curation = {
  groups: [
    {
      id: "drawing",
      title: "Drawing (2D)",
      blurb:
        "The modern 2D API: the draw() pen, canned drawX() shapes, and the Drawing they produce. This is where most models start.",
      pinned: [
        "draw",
        "DrawingPen",
        "Drawing",
        "drawCircle",
        "drawRectangle",
        "drawRoundedRectangle",
        "drawEllipse",
        "drawPolysides",
        "drawText",
      ],
    },
    {
      id: "sketching",
      title: "Sketching — from 2D to 3D",
      blurb:
        "A Sketch is a 2D profile placed on a plane in 3D — what you extrude, revolve, or loft. Obtained from drawing.sketchOnPlane(), or directly via the canned sketchX() helpers.",
      pinned: ["Sketch", "sketchCircle", "sketchRectangle", "sketchRoundedRectangle"],
    },
    {
      id: "solids",
      title: "Making solids",
      blurb:
        "Primitives and depth operations that produce 3D shapes directly — makeX() builders plus the lower-level extrusion, sweep, and loft functions.",
      pinned: [
        "makeBaseBox",
        "makeCylinder",
        "makeSphere",
        "makeBox",
        "loft",
        "genericSweep",
      ],
    },
    {
      id: "shapes",
      title: "Shapes & topology",
      blurb:
        "The shape class hierarchy (Solid, Face, Edge, Wire, …) with every method inline, plus casting and topology-iteration utilities. Booleans, fillet/chamfer/shell, and transforms are methods here.",
      pinned: [
        "Shape3D",
        "Solid",
        "Face",
        "Edge",
        "Wire",
        "Shell",
        "Compound",
        "Vertex",
      ],
    },
    {
      id: "transforms",
      title: "Planes, points & transforms",
      blurb:
        "Reference geometry: planes to sketch on, points and vectors, and the standalone transform helpers.",
      pinned: ["makePlane", "Plane", "Vector", "translate", "rotate", "mirror", "scale"],
    },
    {
      id: "finders",
      title: "Finders",
      blurb:
        "Selectors that pick edges, faces, or corners for fillet, chamfer, and shell — chainable filters, combined with combineFinderFilters().",
      pinned: ["EdgeFinder", "FaceFinder", "CornerFinder", "combineFinderFilters"],
    },
    {
      id: "measure",
      title: "Measuring",
      blurb: "Volume, area, length, distances, and physical properties of shapes.",
      pinned: ["measureVolume", "measureArea", "measureLength", "measureDistanceBetween"],
    },
    {
      id: "projection",
      title: "Projection",
      blurb:
        "Project a 3D shape onto a plane as 2D drawings — how this guide's own 3D visuals are made.",
      pinned: ["drawProjection", "ProjectionCamera", "lookFromPlane"],
    },
    {
      id: "text",
      title: "Text & fonts",
      blurb:
        "Font loading and text sketching. A font must be registered with loadFont() before drawText()/sketchText() can measure glyphs.",
      pinned: ["loadFont", "sketchText"],
    },
    {
      id: "import-export",
      title: "Import & export",
      blurb:
        "STEP/STL import and assembly export. Single-shape export lives on the shape itself (shape.blobSTL() / shape.blobSTEP()).",
      pinned: ["importSTEP", "importSTL", "exportSTEP", "createAssembly"],
    },
    {
      id: "blueprints",
      title: "Blueprints — low-level 2D",
      blurb:
        "Plane-agnostic 2D geometry underneath Drawing. Reach for these only when the Drawing API can't express what you need.",
      pinned: ["Blueprint", "Blueprints", "fuse2D", "cut2D", "intersect2D"],
    },
    {
      id: "legacy-sketcher",
      title: "Legacy Sketcher",
      legacy: true,
      blurb:
        "The older 3D-world-coordinate sketching API. Prefer draw() and sketchOnPlane() — documented in the quick refs. Kept here for existing models (R10): signatures and docs only.",
      pinned: ["Sketcher", "FaceSketcher", "BlueprintSketcher"],
    },
    {
      id: "system",
      title: "System & low-level",
      blurb:
        "OpenCascade/manifold wiring, garbage-collection helpers, and constants. Only needed when embedding replicad — see “use as a library”.",
      pinned: ["setOC", "getOC"],
    },
  ],

  groupByFile: {
    "draw.ts": "drawing",
    "lib2d/definitions.ts": "drawing", // Point2D — the pen's coordinate type
    "sketches/": "sketching",
    "sketcherlib.ts": "legacy-sketcher", // GenericSketcher (SplineConfig overridden below)
    "curves.ts": "sketching", // ScaleMode — sketchOnFace's scaling strategy
    "addThickness.ts": "solids",
    "shapeHelpers.ts": "solids",
    "shortcuts.ts": "solids",
    "shapes.ts": "shapes",
    "shapeInterfaces.ts": "shapes",
    "meshShapes.ts": "shapes",
    "definitionMaps.ts": "shapes", // CurveType — curve classification on shapes
    "geom.ts": "transforms",
    "geomHelpers.ts": "transforms",
    "finders/": "finders",
    "measureShape.ts": "measure",
    "projection/": "projection",
    "text.ts": "text",
    "importers.ts": "import-export",
    "export/": "import-export",
    "blueprints/": "blueprints",
    "lib2d/": "blueprints", // Curve2D, BoundingBox2d, axis2d (Point2D overridden above)
    "Sketcher.ts": "legacy-sketcher",
    "Sketcher2d.ts": "legacy-sketcher",
    "oclib.ts": "system",
    "manifoldlib.ts": "system",
    "register.ts": "system",
    "constants.ts": "system",
  },

  groupOverrides: {
    // lives in draw.ts but belongs with the projection machinery
    drawProjection: "projection",
    // spline config is a pen concern in the modern API, not a sketcher one
    SplineConfig: "drawing",
  },

  symbols: {
    // --- drawing --------------------------------------------------------
    draw: { exampleIds: ["draw-pen-basics"] },
    DrawingPen: {
      entryPoint: "draw(startPoint?) → DrawingPen",
      exampleIds: ["pen-lines", "pen-arcs"],
    },
    Drawing: {
      entryPoint: "pen.close() / pen.done(), or any canned drawX() → Drawing",
      exampleIds: ["drawing-rotate", "drawing-booleans"],
    },
    drawCircle: { exampleIds: ["draw-circle"] },
    drawRectangle: { exampleIds: ["draw-rectangle"] },
    drawRoundedRectangle: { exampleIds: ["draw-rounded-rectangle"] },
    drawEllipse: { exampleIds: ["draw-ellipse"] },
    drawPolysides: { exampleIds: ["draw-polysides"] },
    drawSingleCircle: { exampleIds: ["draw-single-circle"] },
    drawParametricFunction: { exampleIds: ["draw-parametric"] },

    // --- sketching ------------------------------------------------------
    Sketch: {
      entryPoint: 'drawing.sketchOnPlane(plane? = "XY", origin?) → Sketch',
      exampleIds: ["extrude", "revolve"],
    },
    Sketches: {
      entryPoint: "drawing.sketchOnPlane() on a multi-shape drawing → Sketches",
    },
    CompoundSketch: {
      entryPoint: "sketchOnPlane() on a drawing with holes → CompoundSketch",
    },
    sketchCircle: { exampleIds: ["canned-sketches"] },
    sketchRectangle: { exampleIds: ["canned-sketches"] },

    // --- solids ---------------------------------------------------------
    makeBaseBox: { exampleIds: ["primitives"] },
    makeCylinder: { exampleIds: ["primitives"] },
    makeSphere: { exampleIds: ["primitives"] },
    makeHelix: { exampleIds: ["make-helix"] },

    // --- shapes ---------------------------------------------------------
    Shape: {
      entryPoint: "the base class — every shape below extends it",
    },
    Solid: {
      entryPoint: "sketch.extrude() / revolve() / loftWith(), or a makeX() primitive → Solid",
      exampleIds: ["fillet", "shell"],
    },
    Face: { entryPoint: "new FaceFinder().…find(shape) or shape.faces → Face" },
    Edge: { entryPoint: "new EdgeFinder().…find(shape) or shape.edges → Edge" },
    Wire: { entryPoint: "shape.wires, or assembleWire(edges) → Wire" },
    Vertex: { entryPoint: "makeVertex(point) or shape.vertices → Vertex" },
    Shell: { entryPoint: "solid.shells → Shell" },
    Compound: { entryPoint: "compoundShapes(shapes) → Compound" },

    // --- transforms -----------------------------------------------------
    makePlane: { exampleIds: ["make-plane"] },
    Plane: { entryPoint: 'makePlane("XY", origin?) → Plane' },
    BoundingBox: { entryPoint: "shape.boundingBox → BoundingBox" },

    // --- finders --------------------------------------------------------
    EdgeFinder: {
      entryPoint: "new EdgeFinder() → chain filters → use in fillet/chamfer",
      exampleIds: ["finders"],
    },
    FaceFinder: {
      entryPoint: "new FaceFinder() → chain filters → use in shell/sketchOnFace",
      exampleIds: ["shell"],
    },
    CornerFinder: {
      entryPoint: "new CornerFinder() → chain filters → use in drawing.fillet/chamfer",
      exampleIds: ["drawing-corners"],
    },

    // --- measure --------------------------------------------------------
    DistanceQuery: { entryPoint: "measureDistanceBetween() uses it → DistanceQuery" },
    DistanceTool: { entryPoint: "new DistanceTool() → DistanceTool" },
    VolumePhysicalProperties: {
      entryPoint: "measureShapeVolumeProperties(shape) → VolumePhysicalProperties",
    },
    SurfacePhysicalProperties: {
      entryPoint: "measureShapeSurfaceProperties(shape) → SurfacePhysicalProperties",
    },
    LinearPhysicalProperties: {
      entryPoint: "measureShapeLinearProperties(shape) → LinearPhysicalProperties",
    },

    // --- import/export --------------------------------------------------
    AssemblyExporter: { entryPoint: "createAssembly(shapes) → AssemblyExporter" },

    // --- blueprints -----------------------------------------------------
    Blueprint: { entryPoint: "drawing.blueprint, or new Blueprint(curves) → Blueprint" },
  },
};
