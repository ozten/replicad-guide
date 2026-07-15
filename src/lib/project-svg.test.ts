import { beforeAll, describe, expect, it } from "vitest";
import { getEvaluator } from "./evaluator-setup";
import {
  cameraForShape,
  prettyProjectionSvg,
  projectPoint,
} from "./project-svg";

/** makeBaseBox(20, 30, 15): x ∈ [-10, 10], y ∈ [-15, 15], z ∈ [0, 15]. */
const BOX_CODE = `const main = () => {
  const { makeBaseBox } = replicad;
  return makeBaseBox(20, 30, 15);
};`;

const BOX_CORNERS: [number, number, number][] = [];
for (const x of [-10, 10])
  for (const y of [-15, 15])
    for (const z of [0, 15]) BOX_CORNERS.push([x, y, z]);

let shape: any;

beforeAll(async () => {
  const evaluator = await getEvaluator();
  const result = await evaluator.buildShapesFromCode(BOX_CODE, {});
  if (!Array.isArray(result)) {
    throw new Error("test box failed to build");
  }
  shape = evaluator.getShapeEntries()[0]?.shape;
  if (!shape) throw new Error("no shape in evaluator memory");
});

function parseViewbox(svg: string): [number, number, number, number] {
  const match = svg.match(/viewBox="([^"]*)"/);
  expect(match).toBeTruthy();
  return match![1].split(/\s+/).map(Number) as [number, number, number, number];
}

describe("projectPoint", () => {
  it("matches the frame of the real HLR projection", () => {
    // For a box, the projected silhouette is the hull of its 8 projected
    // corners, so the emitted viewBox must equal their bounding box plus the
    // exporter's margin of 1. This pins the pure-math projection to OCCT's
    // HLRAlgo_Projector — if the frame (offset, axis, or y flip) drifted,
    // these numbers would disagree.
    const svg = prettyProjectionSvg(shape, "hidden");
    const [vx, vy, vw, vh] = parseViewbox(svg);

    const { camera } = cameraForShape(shape);
    const projected = BOX_CORNERS.map((corner) => projectPoint(camera, corner));
    const xs = projected.map(([x]) => x);
    const ys = projected.map(([, y]) => y);
    const margin = 1;

    expect(Math.min(...xs) - margin).toBeCloseTo(vx, 1);
    expect(Math.min(...ys) - margin).toBeCloseTo(vy, 1);
    expect(Math.max(...xs) - Math.min(...xs) + 2 * margin).toBeCloseTo(vw, 1);
    expect(Math.max(...ys) - Math.min(...ys) + 2 * margin).toBeCloseTo(vh, 1);
  });
});

describe("prettyProjectionSvg origin triad", () => {
  it("leaves unannotated projections without an overlay", () => {
    const svg = prettyProjectionSvg(shape, "hidden");
    expect(svg).not.toContain("annotations");
  });

  it("draws three colored arms starting at the projected origin", () => {
    const svg = prettyProjectionSvg(shape, "hidden", { origin: true });
    expect(svg).toContain('class="annotations"');
    for (const color of ["#dc2626", "#16a34a", "#2563eb"]) {
      expect(svg).toContain(`stroke="${color}"`);
    }
    for (const axis of ["x", "y", "z"]) {
      expect(svg).toMatch(new RegExp(`<text [^>]*>${axis}</text>`));
    }

    // triad arms are the only stroked line paths; each starts at the origin
    const { camera } = cameraForShape(shape);
    const [ox, oy] = projectPoint(camera, [0, 0, 0]);
    const arms = [
      ...svg.matchAll(/<path d="M (-?[\d.]+) (-?[\d.]+) L [^"]*" stroke="#/g),
    ];
    expect(arms).toHaveLength(3);
    for (const [, startX, startY] of arms) {
      expect(Number(startX)).toBeCloseTo(ox, 1);
      expect(Number(startY)).toBeCloseTo(oy, 1);
    }
  });

  it("grows the viewBox to contain the triad", () => {
    const plain = parseViewbox(prettyProjectionSvg(shape, "hidden"));
    const annotated = parseViewbox(
      prettyProjectionSvg(shape, "hidden", { origin: true }),
    );
    // the box sits between z=0 and z=15 with the origin on its bottom face,
    // so the arms extend past the silhouette and the viewBox must grow
    expect(annotated[2]).toBeGreaterThan(plain[2]);
    expect(annotated[3]).toBeGreaterThan(plain[3]);
  });
});
