/**
 * 3D quick-reference examples (U6): the 2D→3D bridge band first, then make
 * (extrude/revolve/loft/sweep), combine (booleans), refine (fillet/chamfer/
 * shell), and transform/select/export — ordered most-common → least-common
 * per docs/reference/replicad-api-inventory.md §2–§6.
 */
import type { Example } from "../index";

/** Page sections in display order; each group renders under its section. */
export const groups3d = [
  { id: "bridge", title: "From 2D to 3D — the bridge" },
  { id: "depth", title: "Give it depth" },
  { id: "combine", title: "Combine solids" },
  { id: "refine", title: "Refine — fillet, chamfer, shell" },
  { id: "transform", title: "Transform, select, export" },
  { id: "rare", title: "Rarely needed" },
] as const;

export const examples3d: Example[] = [
  // ─── From 2D to 3D — the bridge ────────────────────────────────────────
  {
    id: "sketch-on-plane",
    title: "Lift a drawing onto a plane",
    entryPoint: 'drawing.sketchOnPlane(plane? = "XY", origin?) → Sketch',
    group: "bridge",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { drawRoundedRectangle } = replicad;
  // Named planes: "XY", "XZ", "YZ", "front", "top", "left"...
  // A number as origin offsets along the plane's normal.
  return drawRoundedRectangle(30, 20, 3)
    .sketchOnPlane("XZ")
    .extrude(10);
};`,
  },
  {
    id: "make-plane",
    title: "Build a plane, then sketch on it",
    entryPoint: 'makePlane(plane? = "XY", origin? = [0,0,0]) → Plane',
    group: "bridge",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { drawCircle, makePlane } = replicad;
  // A Plane is a full reference frame: offset it, pivot it, reuse it.
  const tilted = makePlane("XY", [0, 0, 12]).pivot(20, "Y");
  return drawCircle(10).sketchOnPlane(tilted).extrude(6);
};`,
  },
  {
    id: "sketch-on-face",
    title: "Sketch on the face of a solid",
    entryPoint: "drawing.sketchOnFace(face, scaleMode?) → Sketch",
    group: "bridge",
    commonness: "COMMON",
    code: `const main = () => {
  const { makeBaseBox, drawCircle, FaceFinder } = replicad;
  const box = makeBaseBox(40, 30, 15);
  const top = new FaceFinder().inPlane("XY", 15).find(box, { unique: true });
  const hole = drawCircle(6).sketchOnFace(top, "original");
  return box.cut(hole.extrude(-15));
};`,
  },
  {
    id: "canned-sketches",
    title: "Canned sketches — skip the pen",
    entryPoint: "sketchCircle(r, config?) / sketchRectangle(w, h, config?) → Sketch",
    group: "bridge",
    commonness: "COMMON",
    code: `const main = () => {
  const { sketchRectangle, sketchCircle } = replicad;
  const base = sketchRectangle(40, 25).extrude(5);
  const boss = sketchCircle(8, { origin: [0, 0, 5] }).extrude(10);
  return base.fuse(boss);
};`,
  },

  // ─── Give it depth ─────────────────────────────────────────────────────
  {
    id: "extrude",
    title: "Extrude a profile",
    entryPoint: "sketch.extrude(distance, config?) → Shape3D",
    group: "depth",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { draw } = replicad;
  const profile = draw()
    .hLine(30)
    .halfEllipse(0, 20, 5)
    .hLine(-30)
    .close();
  return profile.sketchOnPlane("XZ").extrude(15);
};`,
  },
  {
    id: "extrude-twist",
    title: "Extrude with a twist",
    entryPoint: "sketch.extrude(distance, { twistAngle, extrusionProfile? })",
    group: "depth",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawPolysides } = replicad;
  return drawPolysides(12, 6)
    .sketchOnPlane()
    .extrude(40, { twistAngle: 90 });
};`,
  },
  {
    id: "revolve",
    title: "Revolve a profile",
    entryPoint: "sketch.revolve(axis? = Z, { origin?, angle? }) → Shape3D",
    group: "depth",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { draw } = replicad;
  // Keep the profile on one side of the axis; here x >= 0, spun around Z.
  const profile = draw()
    .hLine(12)
    .line(-2, 18)
    .smoothSplineTo([4, 28])
    .hLineTo(0)
    .close();
  return profile.sketchOnPlane("XZ").revolve();
};`,
  },
  {
    id: "loft",
    title: "Loft between sketches",
    entryPoint: "sketch.loftWith(otherSketch, config?) → Shape3D",
    group: "depth",
    commonness: "COMMON",
    code: `const main = () => {
  const { sketchRectangle, sketchCircle } = replicad;
  const base = sketchRectangle(30, 30);
  const top = sketchCircle(8, { origin: [0, 0, 25] });
  return base.loftWith(top);
};`,
  },
  {
    id: "sweep",
    title: "Sweep a profile along a path",
    entryPoint: "pathSketch.sweepSketch((plane, origin) => Sketch, config?)",
    group: "depth",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw, sketchCircle } = replicad;
  // An open drawing (done, not close) becomes the sweep path.
  const path = draw()
    .line(0, 30)
    .tangentArc(15, 15)
    .line(30, 0)
    .done();
  return path
    .sketchOnPlane("XZ")
    .sweepSketch((plane, origin) => sketchCircle(4, { plane, origin }));
};`,
  },
  {
    id: "primitives",
    title: "Primitive solids",
    entryPoint: "makeBaseBox(x, y, z) / makeCylinder(r, h, at?, dir?) / makeSphere(r)",
    group: "depth",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox, makeCylinder, makeSphere } = replicad;
  return makeBaseBox(24, 24, 12)
    .fuse(makeCylinder(7, 28, [30, 0, 0]))
    .fuse(makeSphere(9).translate(55, 0, 9));
};`,
  },

  // ─── Combine solids ────────────────────────────────────────────────────
  {
    id: "fuse",
    title: "Fuse — union",
    entryPoint: "shape.fuse(other, config?) → Shape3D",
    group: "combine",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox, makeCylinder } = replicad;
  // Booleans are immutable: they return a NEW shape.
  return makeBaseBox(30, 30, 10).fuse(makeCylinder(8, 25));
};`,
  },
  {
    id: "cut",
    title: "Cut — difference",
    entryPoint: "shape.cut(tool, config?) → Shape3D",
    group: "combine",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox, makeCylinder } = replicad;
  const box = makeBaseBox(40, 25, 15);
  const drill = makeCylinder(6, 25, [0, 0, -5]);
  return box.cut(drill);
};`,
  },
  {
    id: "intersect",
    title: "Intersect — common volume",
    entryPoint: "shape.intersect(tool) → Shape3D",
    group: "combine",
    commonness: "COMMON",
    code: `const main = () => {
  const { makeBaseBox, makeSphere } = replicad;
  return makeBaseBox(26, 26, 26)
    .intersect(makeSphere(17).translate(0, 0, 13));
};`,
  },

  // ─── Refine — fillet, chamfer, shell ───────────────────────────────────
  {
    id: "fillet",
    title: "Fillet — round edges",
    entryPoint: "shape.fillet(radius, filter?: (e: EdgeFinder) => EdgeFinder)",
    group: "refine",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  // No filter = every edge. The filter picks edges with an EdgeFinder.
  return makeBaseBox(30, 20, 12).fillet(4, (e) => e.inDirection("Z"));
};`,
  },
  {
    id: "chamfer",
    title: "Chamfer — bevel edges",
    entryPoint: "shape.chamfer(distance, filter?) → Shape3D",
    group: "refine",
    commonness: "COMMON",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  return makeBaseBox(30, 20, 12).chamfer(2.5);
};`,
  },
  {
    id: "shell",
    title: "Shell — hollow a solid",
    entryPoint: "shape.shell(thickness, faceFilter, tolerance?) → Shape3D",
    group: "refine",
    commonness: "COMMON",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  const box = makeBaseBox(30, 22, 14);
  // Negative thickness builds the walls inward; the picked face is removed.
  return box.shell(-2, (f) => f.inPlane("XY", 14));
};`,
  },

  // ─── Transform, select, export ─────────────────────────────────────────
  {
    id: "transforms",
    title: "Translate, rotate, clone",
    entryPoint: "shape.translate(x, y, z) / shape.rotate(angle, center?, axis?)",
    group: "transform",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  const arm = makeBaseBox(40, 8, 6).translate(20, 0, 0);
  return arm.fuse(arm.clone().rotate(45, [0, 0, 0], [0, 0, 1]));
};`,
    // the triad marks [0, 0, 0] — the pivot of the rotate, on the z axis
    annotations: { origin: true },
  },
  {
    id: "mirror",
    title: "Mirror a shape",
    entryPoint: "shape.mirror(plane?, origin?) → Shape3D",
    group: "transform",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  const half = draw()
    .vLine(20)
    .tangentArc(8, 8)
    .hLine(12)
    .vLineTo(0)
    .close()
    .sketchOnPlane()
    .extrude(6);
  return half.fuse(half.clone().mirror("YZ"));
};`,
  },
  {
    id: "finders",
    title: "Finders — select edges and faces",
    entryPoint: "new EdgeFinder() / new FaceFinder(), chain filters, use in fillet/shell",
    group: "transform",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  const box = makeBaseBox(34, 22, 14);
  // Chaining ANDs filters; either([...]) ORs them; not(...) negates.
  return box.fillet(3, (e) =>
    e.either([
      (f) => f.inPlane("XY", 14),
      (f) => f.inPlane("XY", 0),
    ])
  );
};`,
  },
  {
    id: "export-stl",
    title: "Export STL / STEP",
    entryPoint: "shape.blobSTL(config?) / shape.blobSTEP() → Blob",
    group: "transform",
    commonness: "COMMON",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  const part = makeBaseBox(30, 20, 10).fillet(2);
  const stl = part.blobSTL({ tolerance: 0.01 });
  console.log("STL size:", stl.size, "bytes");
  return part;
};`,
  },

  // ─── Rarely needed ─────────────────────────────────────────────────────
  {
    id: "scale",
    title: "Scale a shape",
    entryPoint: "shape.scale(factor, center?) → Shape3D",
    group: "rare",
    commonness: "OBSCURE",
    code: `const main = () => {
  const { makeBaseBox } = replicad;
  const step = makeBaseBox(20, 20, 10);
  return step.fuse(step.clone().scale(0.6).translate(24, 0, 0));
};`,
  },
  {
    id: "make-helix",
    title: "Helix wire",
    entryPoint: "makeHelix(pitch, height, radius, center?, dir?, lefthand?) → Edge",
    group: "rare",
    commonness: "OBSCURE",
    code: `const main = () => {
  const { makeHelix, assembleWire, Sketch, sketchCircle } = replicad;
  const path = new Sketch(assembleWire([makeHelix(8, 40, 10)]));
  return path.sweepSketch((plane, origin) => sketchCircle(2, { plane, origin }));
};`,
  },
];
