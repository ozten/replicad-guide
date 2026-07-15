import { describe, expect, it } from "vitest";
import {
  assertValidBuildResult,
  renderExample,
  svgFromDrawingEntry,
} from "./render-engine";

const CIRCLE_2D = `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`;

const BOX_3D = `const main = () => {
  const { drawRoundedRectangle } = replicad;
  return drawRoundedRectangle(30, 20, 3).sketchOnPlane().extrude(10);
};`;

const MIXED_3D_AND_2D = `const main = () => {
  const { drawRoundedRectangle, drawCircle } = replicad;
  const box = drawRoundedRectangle(30, 20, 3).sketchOnPlane().extrude(10);
  return [box, drawCircle(5)];
};`;

describe("renderExample", () => {
  it("renders a 2D drawing to an inline SVG", async () => {
    const visuals = await renderExample("circle", CIRCLE_2D);

    expect(visuals).toHaveLength(1);
    expect(visuals[0].kind).toBe("2d");
    expect(visuals[0].svg).toContain("viewBox=");
    expect(visuals[0].svg).toMatch(/<path[^>]+d="/);
  });

  it("renders a 3D solid to a projection SVG with visible and hidden lines", async () => {
    const visuals = await renderExample("box", BOX_3D);

    expect(visuals).toHaveLength(1);
    expect(visuals[0].kind).toBe("3d");
    expect(visuals[0].svg).toContain("viewBox=");
    expect(visuals[0].svg).toMatch(/<path[^>]+d="/);
    // hidden lines are rendered dashed
    expect(visuals[0].svg).toContain("stroke-dasharray");
  });

  it("renders a mixed example to one visual per entry, nothing dropped", async () => {
    const visuals = await renderExample("mixed", MIXED_3D_AND_2D);

    expect(visuals.map((v) => v.kind)).toEqual(["3d", "2d"]);
  });

  it("fails loudly, naming the example, when the code throws", async () => {
    await expect(
      renderExample("broken", `const main = () => { throw new Error("boom"); };`),
    ).rejects.toThrow(/\[broken\].*boom/);
  });

  it("fails when an example produces no output", async () => {
    await expect(
      renderExample("empty", `const main = () => [];`),
    ).rejects.toThrow(/\[empty\]/);
  });

  it("fails when an example returns a non-shape", async () => {
    await expect(
      renderExample("nonshape", `const main = () => 42;`),
    ).rejects.toThrow(/\[nonshape\]/);
  });

  it("is deterministic: same code renders to identical SVG", async () => {
    const first = await renderExample("det", CIRCLE_2D);
    const second = await renderExample("det", CIRCLE_2D);

    expect(second).toEqual(first);
  });
});

describe("assertValidBuildResult", () => {
  it("rejects the evaluator's returned error object", () => {
    expect(() =>
      assertValidBuildResult("id1", {
        error: true,
        message: "kernel exploded",
      }),
    ).toThrow(/\[id1\].*kernel exploded/);
  });

  it("rejects an empty result array", () => {
    expect(() => assertValidBuildResult("id2", [])).toThrow(/\[id2\]/);
  });

  it("rejects a result where one entry carries a swallowed error", () => {
    const broken = [
      { name: "Good", format: "svg", paths: ["M 0 0"], viewbox: "0 0 1 1" },
      { name: "Bad", error: true, message: "mesh failed" },
    ];

    expect(() => assertValidBuildResult("id3", broken)).toThrow(
      /\[id3\].*Bad.*mesh failed/,
    );
  });

  it("accepts a valid result array", () => {
    expect(() =>
      assertValidBuildResult("id4", [
        { name: "Shape", format: "svg", paths: ["M 0 0"], viewbox: "0 0 1 1" },
      ]),
    ).not.toThrow();
  });

  it("falls back to a generic message when an error entry has none", () => {
    expect(() =>
      assertValidBuildResult("id5", [{ name: "Bad", error: true, message: null }]),
    ).toThrow(/\[id5\].*unknown error/);
  });
});

describe("periodic GC nudge", () => {
  it("invokes globalThis.gc once every 10 renders when exposed", async () => {
    const hadGc = "gc" in globalThis;
    const originalGc = globalThis.gc;
    let calls = 0;
    globalThis.gc = (() => {
      calls += 1;
    }) as typeof globalThis.gc;

    try {
      for (let i = 0; i < 10; i += 1) {
        await renderExample("gc-probe", CIRCLE_2D);
      }
      // the module-level counter may have started mid-cycle from earlier
      // tests, so 10 renders trigger at least one and at most two nudges
      expect(calls).toBeGreaterThanOrEqual(1);
      expect(calls).toBeLessThanOrEqual(2);
    } finally {
      if (hadGc) {
        globalThis.gc = originalGc;
      } else {
        delete (globalThis as Record<string, unknown>).gc;
      }
    }
  });
});

describe("svgFromDrawingEntry", () => {
  it("composes an SVG document from a 2D entry, flattening nested paths", () => {
    const svg = svgFromDrawingEntry("flat", {
      name: "Shape",
      format: "svg",
      paths: [["M 0 0 L 1 1"], ["M 2 2"]],
      viewbox: "0 0 10 10",
    });

    expect(svg).toContain('viewBox="0 0 10 10"');
    expect(svg.match(/<path /g)).toHaveLength(2);
  });

  it("rejects a 2D entry with no paths", () => {
    expect(() =>
      svgFromDrawingEntry("nopaths", {
        name: "Shape",
        format: "svg",
        paths: [],
        viewbox: "0 0 10 10",
      }),
    ).toThrow(/\[nopaths\]/);
  });
});
