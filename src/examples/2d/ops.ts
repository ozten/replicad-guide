/** "Operating on a Drawing": transforms, booleans, corners, offset. */
import type { Example } from "../index";

export const opsExamples: Example[] = [
  {
    id: "drawing-rotate",
    title: "Rotate a drawing",
    entryPoint: "drawing.rotate(angle, center? = [0, 0]) → Drawing",
    group: "Operating on a Drawing",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { drawRectangle } = replicad;
  // angle in degrees, counterclockwise around [0, 0] by default
  return drawRectangle(40, 15).rotate(30);
};`,
    // the cross marks the pivot the rotation happens around
    annotations: { origin: true },
  },
  {
    id: "drawing-translate-mirror",
    title: "Move and mirror",
    entryPoint:
      "drawing.translate(dx, dy) · drawing.mirror(direction, origin?, mode?)",
    group: "Operating on a Drawing",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawPolysides } = replicad;
  const triangle = drawPolysides(10, 3).translate(15, 0);
  // "plane" mode reflects over the line through origin along [0, 1]
  return triangle.fuse(triangle.mirror([0, 1], [0, 0], "plane"));
};`,
    // the cross marks the origin the mirror line passes through
    annotations: { origin: true },
  },
  {
    id: "drawing-booleans",
    title: "2D booleans: fuse, cut, intersect",
    entryPoint:
      "drawing.fuse(other) · drawing.cut(other) · drawing.intersect(other)",
    group: "Operating on a Drawing",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawRoundedRectangle, drawCircle } = replicad;
  // a plate with a hole: cut removes the circle
  return drawRoundedRectangle(40, 25, 4).cut(drawCircle(7));
};`,
  },
  {
    id: "drawing-corners",
    title: "Fillet and chamfer corners",
    entryPoint: "drawing.fillet(radius, filter?) · drawing.chamfer(radius, filter?)",
    group: "Operating on a Drawing",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawRectangle } = replicad;
  // no filter = every corner; a CornerFinder picks some of them
  return drawRectangle(40, 20).fillet(6, (c) => c.inBox([0, -20], [30, 20]));
};`,
    // the blue box is the inBox region: only corners inside it get filleted
    annotations: {
      origin: true,
      boxes: [{ from: [0, -20], to: [30, 20] }],
    },
  },
  {
    id: "drawing-offset",
    title: "Offset: grow or shrink an outline",
    entryPoint: "drawing.offset(distance, config?) → Drawing",
    group: "Operating on a Drawing",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawPolysides } = replicad;
  const hexagon = drawPolysides(15, 6);
  // positive grows, negative shrinks — cutting makes a ring
  return hexagon.offset(4).cut(hexagon);
};`,
  },
];
