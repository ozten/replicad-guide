/** "Start here — the pen": draw() and the fluent DrawingPen. */
import type { Example } from "../index";

export const penExamples: Example[] = [
  {
    id: "draw-pen-basics",
    title: "Start a drawing with the pen",
    entryPoint: "draw(startPoint?) → DrawingPen",
    group: "Start here — the pen",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { draw } = replicad;
  // chain segments from the start point, then close() into a Drawing
  return draw()
    .hLine(30)
    .vLine(15)
    .lineTo([0, 25])
    .close();
};`,
  },
  {
    id: "pen-lines",
    title: "Straight segments, relative and absolute",
    entryPoint:
      "pen.line(dx, dy) · pen.lineTo([x, y]) · pen.hLine/vLine/polarLine",
    group: "Start here — the pen",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { draw } = replicad;
  return draw()
    .line(20, 10) // relative to the pen position
    .hLine(15) // horizontal, relative
    .vLineTo(30) // vertical, to an absolute y
    .polarLine(25, 150) // distance at an angle (degrees)
    .lineTo([0, 15]) // to an absolute point
    .close();
};`,
  },
  {
    id: "pen-arcs",
    title: "Arcs through a point and tangent arcs",
    entryPoint: "pen.threePointsArc(dx, dy, viaDx, viaDy) · pen.tangentArc(dx, dy)",
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  return draw()
    .hLine(20)
    // ends 20 right, passing through a point 10 right and 8 up
    .threePointsArc(20, 0, 10, 8)
    // starts tangent to the previous curve
    .tangentArc(15, -10)
    .vLine(-15)
    .close();
};`,
  },
  {
    id: "pen-sagitta-bulge",
    title: "Bulging arcs: sagitta and bulge",
    entryPoint: "pen.sagittaArc(dx, dy, sagitta) · pen.bulgeArc(dx, dy, bulge)",
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  return draw()
    // sagitta = height of the bulge over the chord
    .sagittaArc(30, 0, 8)
    .vLine(-10)
    // bulge is relative: 1 would be a half circle
    .bulgeArc(-30, 0, 0.5)
    .close();
};`,
  },
  {
    id: "draw-half-circle",
    title: "Draw a half circle",
    entryPoint: "pen.sagittaArc(dx, dy, sagitta) — sagitta = radius",
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  // half circle of radius 20: a 40-wide chord bulging by the radius
  return draw([-20, 0]).sagittaArc(40, 0, 20).close();
};`,
  },
  {
    id: "pen-half-ellipse",
    title: "Half-ellipse arcs",
    entryPoint: "pen.halfEllipse(dx, dy, minorRadius, sweep?)",
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  return draw()
    .hLine(25)
    // half an ellipse to a point 40 up, bulging 5 sideways
    .halfEllipse(0, 40, 5)
    .hLine(-25)
    .close();
};`,
  },
  {
    id: "pen-smooth-spline",
    title: "Smooth splines and bézier curves",
    entryPoint: "pen.smoothSpline(dx, dy, config?) · pen.bezierCurveTo(end, controlPoints)",
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  return draw()
    .hLine(30)
    .smoothSpline(-5, 15)
    .smoothSpline(-25, 10)
    .close();
};`,
  },
  {
    id: "pen-custom-corner",
    title: "Round or chamfer a corner as you draw",
    entryPoint: 'pen.customCorner(radius, mode? = "fillet")',
    group: "Start here — the pen",
    commonness: "COMMON",
    code: `const main = () => {
  const { draw } = replicad;
  // call it between two segments to modify the corner they form
  return draw()
    .hLine(30)
    .customCorner(8)
    .vLine(20)
    .customCorner(4, "chamfer")
    .hLine(-30)
    .close();
};`,
  },
  {
    id: "pen-finish",
    title: "Finish: close, done, or mirror",
    entryPoint: "pen.close() / pen.done() / pen.closeWithMirror() → Drawing",
    group: "Start here — the pen",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { draw } = replicad;
  // closeWithMirror reflects the path over the start–end line:
  // draw half a profile, get the symmetric whole
  return draw()
    .hLine(12)
    .line(6, 10)
    .vLine(12)
    .hLine(-18)
    .closeWithMirror();
};`,
  },
];
