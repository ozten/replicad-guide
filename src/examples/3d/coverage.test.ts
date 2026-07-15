import { describe, expect, it } from "vitest";
import { lintExamples } from "../index";
import { examples3d, groups3d } from "./index";
import { renderExample } from "../../lib/render-engine";
import { decodeStudioUrl, toStudioUrl } from "../../lib/studio-link";

describe("3D quick-reference coverage", () => {
  it("passes the registry lint", () => {
    expect(() => lintExamples(examples3d)).not.toThrow();
  });

  it("opens with the bridge group (R2) and it contains sketchOnPlane", () => {
    expect(examples3d[0].group).toBe("bridge");
    expect(groups3d[0].id).toBe("bridge");
    const bridge = examples3d.filter((e) => e.group === "bridge");
    expect(bridge.some((e) => e.code.includes("sketchOnPlane"))).toBe(true);
  });

  it("only uses declared groups, in declaration order", () => {
    const order = groups3d.map((g) => g.id as string);
    let last = 0;
    for (const example of examples3d) {
      const index = order.indexOf(example.group);
      expect(index, `unknown group "${example.group}" (${example.id})`).toBeGreaterThanOrEqual(0);
      expect(index, `group out of order at ${example.id}`).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it("every record gets a studio link that round-trips to its code (R8)", async () => {
    for (const example of examples3d) {
      const url = await toStudioUrl(example.code);
      expect(url).toContain("studio.replicad.xyz");
      expect(await decodeStudioUrl(url)).toBe(example.code);
    }
  });

  // One test per example so a broken record is named directly in the output.
  describe("every record renders a 3D projection at build (R8)", () => {
    for (const example of examples3d) {
      it(`renders: ${example.id}`, async () => {
        const visuals = await renderExample(example.id, example.code);
        expect(visuals.length).toBeGreaterThan(0);
        expect(
          visuals.some((v) => v.kind === "3d"),
          `${example.id} should yield a 3D projection`,
        ).toBe(true);
        for (const visual of visuals) {
          expect(visual.svg).toContain("<path");
        }
      });
    }
  });
});
