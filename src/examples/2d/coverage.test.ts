import { describe, expect, it } from "vitest";
import { renderExample } from "../../lib/render-engine";
import { lintExamples } from "../index";
import { examples2d, groups2d } from "./index";

describe("2D quick-reference coverage", () => {
  it("passes the registry lint", () => {
    expect(() => lintExamples(examples2d)).not.toThrow();
  });

  it("renders every record to at least one SVG (no broken entries)", async () => {
    for (const example of examples2d) {
      const visuals = await renderExample(example.id, example.code);
      expect(visuals.length, example.id).toBeGreaterThan(0);
      for (const visual of visuals) {
        expect(visual.kind, example.id).toBe("2d");
        expect(visual.svg, example.id).toContain("<path");
      }
    }
  });

  it("answers the motivating questions: half circle and rotate", () => {
    const ids = examples2d.map((e) => e.id);
    expect(ids).toContain("draw-half-circle");
    expect(ids).toContain("drawing-rotate");

    const halfCircle = examples2d.find((e) => e.id === "draw-half-circle")!;
    expect(halfCircle.title.toLowerCase()).toContain("half circle");
  });

  it("teaches only the modern API — no legacy Sketcher anywhere (R10)", () => {
    for (const example of examples2d) {
      expect(example.code, example.id).not.toMatch(/Sketcher/);
      expect(example.title, example.id).not.toMatch(/Sketcher/);
      expect(example.entryPoint, example.id).not.toMatch(/Sketcher/);
    }
  });

  it("keeps every record in a known page section", () => {
    const known = new Set<string>(groups2d);
    for (const example of examples2d) {
      expect(known.has(example.group), `${example.id}: ${example.group}`).toBe(
        true,
      );
    }
  });

  it("orders sections most-common → least-common", () => {
    // the first group must contain ESSENTIAL records, the last only OBSCURE
    const first = examples2d.filter((e) => e.group === groups2d[0]);
    const last = examples2d.filter((e) => e.group === groups2d[groups2d.length - 1]);
    expect(first.some((e) => e.commonness === "ESSENTIAL")).toBe(true);
    expect(last.every((e) => e.commonness === "OBSCURE")).toBe(true);
  });
});
