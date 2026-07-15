/** "Rarely needed": kept visible but deemphasized (R3). */
import type { Example } from "../index";

export const rareExamples: Example[] = [
  {
    id: "draw-parametric",
    title: "Parametric curve",
    entryPoint:
      "drawParametricFunction(fn, { pointsCount?, start?, stop?, closeShape? }?) → Drawing",
    group: "Rarely needed",
    commonness: "OBSCURE",
    code: `const main = () => {
  const { drawParametricFunction } = replicad;
  // a spiral, sampled over t in [0, 1]
  return drawParametricFunction((t) => [
    (5 + t * 15) * Math.cos(t * 4 * Math.PI),
    (5 + t * 15) * Math.sin(t * 4 * Math.PI),
  ]);
};`,
  },
  {
    id: "draw-single-circle",
    title: "Circle as a single curve",
    entryPoint: "drawSingleCircle(radius) → Drawing",
    group: "Rarely needed",
    commonness: "OBSCURE",
    code: `const main = () => {
  const { drawSingleCircle } = replicad;
  // one closed curve instead of stitched arcs — prefer drawCircle
  return drawSingleCircle(18);
};`,
  },
  {
    id: "drawing-stretch",
    title: "Stretch along a direction",
    entryPoint: "drawing.stretch(ratio, direction, origin) → Drawing",
    group: "Rarely needed",
    commonness: "OBSCURE",
    code: `const main = () => {
  const { drawCircle } = replicad;
  // 1.8× along the x axis, anchored at the origin
  return drawCircle(15).stretch(1.8, [1, 0], [0, 0]);
};`,
  },
];
