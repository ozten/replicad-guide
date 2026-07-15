/**
 * 3D shape → static SVG projection (visible + optional hidden lines).
 * Ported from replicad-cli's `prettyProjectionSvg` (vendor/replicad/packages/
 * replicad-cli/src/projectSvg.ts) — CLI-internal, not exported, hence the port.
 */
import { ProjectionCamera, drawProjection } from "replicad";

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

function writeSvg(visible: SVGable, hidden?: SVGable) {
  const visiblePath = pathElements(visible);

  if (!hidden) {
    return mainSvg(visible.toSVGViewBox(), visiblePath);
  }

  const viewbox = stringifyViewbox(
    mergeViewboxes([visible.toSVGViewBox(), hidden.toSVGViewBox()]),
  );
  const hiddenPath = pathElements(
    hidden,
    ' stroke-dasharray="1,1" opacity="0.1"',
  );

  return mainSvg(viewbox, `${visiblePath}\n${hiddenPath}`);
}

export function prettyProjectionSvg(
  shape: any,
  projectMode: ProjectMode = "visible",
): string {
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
  const camera = new ProjectionCamera(corner).lookAt(center);
  const { visible, hidden } = drawProjection(shape, camera);

  return writeSvg(visible, projectMode === "hidden" ? hidden : undefined);
}
