/**
 * 3D shape → static SVG projection (visible + optional hidden lines).
 * Ported from replicad-cli's `prettyProjectionSvg` (vendor/replicad/packages/
 * replicad-cli/src/projectSvg.ts) — CLI-internal, not exported, hence the port.
 *
 * Also draws the optional origin-triad annotation (see Annotations.origin):
 * colored x/y/z arms projected through the SAME camera as the shape, so the
 * overlay sits exactly where the origin is in the projection.
 */
import { ProjectionCamera, drawProjection } from "replicad";
import {
  CHAR_WIDTH,
  FONT_RATIO,
  LABEL_FONT,
  fmt,
  type Annotations,
} from "./annotate-svg";

export type ProjectMode = "visible" | "hidden";

type Viewbox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  width: number;
  height: number;
};

type SVGable = {
  toSVGPaths: () => string[] | string[][];
  toSVGViewBox: () => string;
};

function parseViewbox(viewbox?: string): Partial<Viewbox> {
  if (!viewbox) return {};
  const [x, y, width, height] = viewbox
    .split(" ")
    .map((value) => Number.parseFloat(value));

  return {
    xMin: x,
    yMin: y,
    xMax: x + width,
    yMax: y + height,
    width,
    height,
  };
}

function mergeViewboxes(viewboxes: string[]): Viewbox {
  const [xMin, yMin, xMax, yMax] = viewboxes.reduce(
    (acc, viewbox) => {
      const [currentXMin, currentYMin, currentXMax, currentYMax] = acc;
      const parsed = parseViewbox(viewbox);

      return [
        Math.min(parsed.xMin ?? currentXMin, currentXMin),
        Math.min(parsed.yMin ?? currentYMin, currentYMin),
        Math.max(parsed.xMax ?? currentXMax, currentXMax),
        Math.max(parsed.yMax ?? currentYMax, currentYMax),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  );

  return {
    xMin,
    yMin,
    xMax,
    yMax,
    width: xMax - xMin,
    height: yMax - yMin,
  };
}

function stringifyViewbox({ xMin, yMin, xMax, yMax }: Viewbox) {
  return [
    xMin.toFixed(2),
    yMin.toFixed(2),
    (xMax - xMin).toFixed(2),
    (yMax - yMin).toFixed(2),
  ].join(" ");
}

function mainSvg(viewbox: string, body: string) {
  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="${viewbox}" fill="none" stroke="black" stroke-width="0.2%" vector-effect="non-scaling-stroke">
${body}
</svg>`;
}

function pathElements(drawing: SVGable, attributes = "") {
  return drawing
    .toSVGPaths()
    .flat(Infinity)
    .map((path) => `<path${attributes} d="${path}" />`)
    .join("\n");
}

type Overlay = (base: Viewbox) => { markup: string; viewbox: Viewbox };

function writeSvg(visible: SVGable, hidden?: SVGable, overlay?: Overlay) {
  const visiblePath = pathElements(visible);
  const hiddenPath = hidden
    ? pathElements(hidden, ' stroke-dasharray="1,1" opacity="0.1"')
    : null;
  const merged = mergeViewboxes([
    visible.toSVGViewBox(),
    ...(hidden ? [hidden.toSVGViewBox()] : []),
  ]);
  const added = overlay?.(merged);
  const body = [visiblePath, hiddenPath, added?.markup]
    .filter(Boolean)
    .join("\n");

  if (!added) {
    // unannotated output stays byte-identical to the historic format, so
    // existing render-cache entries keep their SVGs unchanged
    return mainSvg(
      hidden ? stringifyViewbox(merged) : visible.toSVGViewBox(),
      body,
    );
  }
  return mainSvg(stringifyViewbox(added.viewbox), body);
}

/** Camera-frame vectors — the slice of ProjectionCamera projectPoint needs. */
type CameraLike = {
  position: { x: number; y: number; z: number };
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
};

/**
 * Orthographic image of a world point in the camera's view plane, in the SVG
 * coordinate frame of the projected drawing. Mirrors OCCT's
 * HLRAlgo_Projector(gp_Ax2) — 2D = components of (p − position) along the
 * camera's x/y axes — plus the y flip replicad's SVG export applies.
 * project-svg.test.ts pins this formula against real HLR output.
 */
export function projectPoint(
  camera: CameraLike,
  [x, y, z]: [number, number, number],
): [number, number] {
  const dx = x - camera.position.x;
  const dy = y - camera.position.y;
  const dz = z - camera.position.z;
  const { xAxis, yAxis } = camera;
  return [
    dx * xAxis.x + dy * xAxis.y + dz * xAxis.z,
    -(dx * yAxis.x + dy * yAxis.y + dz * yAxis.z),
  ];
}

/**
 * The guide's standard projection camera: an isometric-ish view from the
 * bounding box's +x/−y/+z corner, looking at the shape's center.
 */
export function cameraForShape(shape: any): {
  camera: ProjectionCamera;
  maxSide: number;
} {
  if (!shape?.boundingBox) {
    throw new Error("Projection requires a 3D shape with a bounding box");
  }

  const bbox = shape.boundingBox;
  const center = bbox.center;
  const maxSide = Math.max(bbox.width, bbox.height, bbox.depth);
  const corner: [number, number, number] = [
    center[0] + maxSide,
    center[1] - maxSide,
    center[2] + maxSide,
  ];
  return { camera: new ProjectionCamera(corner).lookAt(center), maxSide };
}

/** CAD-conventional axis colors: x red, y green, z blue. */
const AXIS_COLORS = {
  x: "#dc2626",
  y: "#16a34a",
  z: "#2563eb",
} as const;

/**
 * Colored x/y/z arms from the world origin, projected with the shape's own
 * camera so they land exactly where the origin sits in the projection.
 * Returns the overlay markup plus the viewBox grown to contain it.
 */
function originTriad(
  camera: CameraLike,
  armLength: number,
  base: Viewbox,
): { markup: string; viewbox: Viewbox } {
  let { xMin, yMin, xMax, yMax } = base;
  const touch = (x: number, y: number) => {
    xMin = Math.min(xMin, x);
    yMin = Math.min(yMin, y);
    xMax = Math.max(xMax, x);
    yMax = Math.max(yMax, y);
  };

  const [ox, oy] = projectPoint(camera, [0, 0, 0]);
  touch(ox, oy);
  const arms = (["x", "y", "z"] as const).flatMap((axis) => {
    const tip3d: [number, number, number] = [
      axis === "x" ? armLength : 0,
      axis === "y" ? armLength : 0,
      axis === "z" ? armLength : 0,
    ];
    const [tx, ty] = projectPoint(camera, tip3d);
    const length = Math.hypot(tx - ox, ty - oy);
    // an axis parallel to the view direction projects to a dot — skip it
    if (length < 1e-9) return [];
    touch(tx, ty);
    return [{ axis, tx, ty, ux: (tx - ox) / length, uy: (ty - oy) / length }];
  });

  const font = FONT_RATIO * Math.max(xMax - xMin, yMax - yMin);
  const parts = arms.map(
    ({ axis, tx, ty }) =>
      `<path d="M ${fmt(ox)} ${fmt(oy)} L ${fmt(tx)} ${fmt(ty)}" stroke="${AXIS_COLORS[axis]}" stroke-width="${fmt(0.09 * font)}" />`,
  );
  for (const { axis, tx, ty, ux, uy } of arms) {
    // label floats just past the arm tip, along the arm's own direction
    const lx = tx + ux * 0.9 * font;
    const ly = ty + uy * 0.9 * font;
    touch(lx - CHAR_WIDTH * font, ly - 0.8 * font);
    touch(lx + CHAR_WIDTH * font, ly + 0.8 * font);
    parts.push(
      `<text x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="middle" dominant-baseline="central" fill="${AXIS_COLORS[axis]}">${axis}</text>`,
    );
  }

  const pad = 0.6 * font;
  xMin -= pad;
  yMin -= pad;
  xMax += pad;
  yMax += pad;
  return {
    markup: `  <g class="annotations" stroke="none" font-family="${LABEL_FONT}" font-size="${fmt(font)}" font-style="italic">
    ${parts.join("\n    ")}
  </g>`,
    viewbox: {
      xMin,
      yMin,
      xMax,
      yMax,
      width: xMax - xMin,
      height: yMax - yMin,
    },
  };
}

export function prettyProjectionSvg(
  shape: any,
  projectMode: ProjectMode = "visible",
  annotations?: Annotations,
): string {
  const { camera, maxSide } = cameraForShape(shape);
  const { visible, hidden } = drawProjection(shape, camera);

  const overlay = annotations?.origin
    ? (base: Viewbox) => originTriad(camera, 0.45 * maxSide, base)
    : undefined;

  return writeSvg(
    visible,
    projectMode === "hidden" ? hidden : undefined,
    overlay,
  );
}
