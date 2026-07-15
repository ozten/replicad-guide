import { describe, expect, it } from "vitest";
import { annotateSvg, type Annotations } from "./annotate-svg";

/** Mirrors svgFromDrawingEntry's wrapper for a 40×20 rect centered on 0,0. */
const RECT_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="-21 -11 42 22" fill="none" stroke="black" stroke-width="0.6%" vector-effect="non-scaling-stroke">
    <path d="M -20 -10 L 20 -10 L 20 10 L -20 10 Z" />
</svg>`;

function parseViewbox(svg: string): [number, number, number, number] {
  const match = svg.match(/viewBox="([^"]*)"/);
  expect(match).toBeTruthy();
  const values = match![1].split(/\s+/).map(Number);
  expect(values).toHaveLength(4);
  return values as [number, number, number, number];
}

describe("annotateSvg", () => {
  it("returns the document unchanged when there is nothing to draw", () => {
    expect(annotateSvg("x", RECT_SVG)).toBe(RECT_SVG);
    expect(annotateSvg("x", RECT_SVG, {})).toBe(RECT_SVG);
    expect(annotateSvg("x", RECT_SVG, { origin: false, boxes: [] })).toBe(
      RECT_SVG,
    );
  });

  it("keeps the original drawing paths untouched", () => {
    const annotated = annotateSvg("x", RECT_SVG, { origin: true });
    expect(annotated).toContain('<path d="M -20 -10 L 20 -10 L 20 10 L -20 10 Z" />');
  });

  it("flips model y to SVG y for box rects", () => {
    const annotations: Annotations = {
      boxes: [{ from: [0, -20], to: [30, 10] }],
    };
    const annotated = annotateSvg("x", RECT_SVG, annotations);
    // model y ∈ [-20, 10] → SVG y ∈ [-10, 20]: top at -10, height 30
    expect(annotated).toContain(
      '<rect x="0" y="-10" width="30" height="30"',
    );
  });

  it("labels both defining corners with their model coordinates", () => {
    const annotated = annotateSvg("x", RECT_SVG, {
      boxes: [{ from: [0, -20], to: [30, 20] }],
    });
    expect(annotated).toContain(">0, -20</text>");
    expect(annotated).toContain(">30, 20</text>");
  });

  it("expands the viewBox to contain annotation extents", () => {
    const annotated = annotateSvg("x", RECT_SVG, {
      boxes: [{ from: [0, -20], to: [30, 20] }],
    });
    const [minX, minY, width, height] = parseViewbox(annotated);
    expect(minX).toBeLessThanOrEqual(-21);
    expect(minY).toBeLessThan(-20);
    expect(minX + width).toBeGreaterThan(30);
    expect(minY + height).toBeGreaterThan(20);
  });

  it("only grows the viewBox by padding when the box fits the drawing", () => {
    const annotated = annotateSvg("x", RECT_SVG, {
      boxes: [{ from: [-5, -5], to: [5, 5] }],
    });
    const [minX, minY, width, height] = parseViewbox(annotated);
    // labels stack above/below the small box, still inside the drawing, so
    // the viewBox stays the drawing's extent plus breathing room
    expect(minX).toBeLessThanOrEqual(-21);
    expect(minY).toBeLessThanOrEqual(-11);
    expect(minX + width).toBeGreaterThanOrEqual(21);
    expect(minY + height).toBeGreaterThanOrEqual(11);
    expect(minX).toBeGreaterThan(-25);
    expect(minY).toBeGreaterThan(-15);
  });

  it("draws an origin cross with its 0,0 label", () => {
    const annotated = annotateSvg("x", RECT_SVG, { origin: true });
    expect(annotated).toMatch(/<path d="M -[\d.]+ 0 H [\d.]+ M 0 -[\d.]+ V [\d.]+" stroke="#dc2626"/);
    expect(annotated).toContain(">0,0</text>");
  });

  it("gives annotations their own colors and no inherited stroke on text", () => {
    const annotated = annotateSvg("x", RECT_SVG, {
      origin: true,
      boxes: [{ from: [0, -20], to: [30, 20] }],
    });
    expect(annotated).toContain('<g class="annotations" stroke="none"');
    expect(annotated).toContain('stroke="#2563eb"');
    expect(annotated).toContain('fill="#2563eb"');
    // the group sits inside the document
    expect(annotated.trim().endsWith("</svg>")).toBe(true);
  });

  it("throws, naming the example, on non-finite coordinates", () => {
    expect(() =>
      annotateSvg("bad-example", RECT_SVG, {
        boxes: [{ from: [0, Number.NaN], to: [30, 20] }],
      }),
    ).toThrow(/\[bad-example\] annotation boxes\[0\]\.from/);
  });

  it("throws when the document has no parsable viewBox", () => {
    expect(() =>
      annotateSvg("bad-example", "<svg><path d='M 0 0' /></svg>", {
        origin: true,
      }),
    ).toThrow(/\[bad-example\] cannot annotate/);
  });

  it("throws instead of silently dropping the overlay on a truncated document", () => {
    expect(() =>
      annotateSvg("bad-example", RECT_SVG.replace(/<\/svg>\s*$/, ""), {
        origin: true,
      }),
    ).toThrow(/\[bad-example\] cannot annotate: document does not end/);
  });
});
