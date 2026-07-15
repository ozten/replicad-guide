/** "Canned shapes": one-call Drawings — skip the pen entirely. */
import type { Example } from "../index";

export const cannedExamples: Example[] = [
  {
    id: "draw-circle",
    title: "Circle",
    entryPoint: "drawCircle(radius) → Drawing",
    group: "Canned shapes",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`,
  },
  {
    id: "draw-rectangle",
    title: "Rectangle",
    entryPoint: "drawRectangle(width, height) → Drawing (centered on the origin)",
    group: "Canned shapes",
    commonness: "ESSENTIAL",
    code: `const main = () => {
  const { drawRectangle } = replicad;
  return drawRectangle(40, 25);
};`,
  },
  {
    id: "draw-rounded-rectangle",
    title: "Rounded rectangle",
    entryPoint: "drawRoundedRectangle(width, height, r? | { rx?, ry? }) → Drawing",
    group: "Canned shapes",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawRoundedRectangle } = replicad;
  return drawRoundedRectangle(40, 25, 6);
};`,
  },
  {
    id: "draw-ellipse",
    title: "Ellipse",
    entryPoint: "drawEllipse(majorRadius, minorRadius) → Drawing",
    group: "Canned shapes",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawEllipse } = replicad;
  return drawEllipse(25, 15);
};`,
  },
  {
    id: "draw-polysides",
    title: "Regular polygon",
    entryPoint: "drawPolysides(radius, sidesCount, sagitta? = 0) → Drawing",
    group: "Canned shapes",
    commonness: "COMMON",
    code: `const main = () => {
  const { drawPolysides } = replicad;
  // sagitta bulges the sides: positive out, negative in
  return drawPolysides(20, 6);
};`,
  },
];
