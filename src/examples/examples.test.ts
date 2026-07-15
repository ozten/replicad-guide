import { describe, expect, it } from "vitest";
import {
  examples,
  lintExamples,
  validateExample,
  type Example,
} from "./index";

const valid: Example = {
  id: "draw-circle",
  title: "Draw a circle",
  entryPoint: "drawCircle(radius) → Drawing",
  group: "Canned shapes",
  commonness: "ESSENTIAL",
  code: `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`,
};

describe("validateExample (the example contract)", () => {
  it("accepts a conforming example", () => {
    expect(validateExample(valid)).toEqual([]);
  });

  it("rejects code that does not define main by that exact name", () => {
    const errors = validateExample({
      ...valid,
      code: `const model = () => replicad.drawCircle(20);`,
    });
    expect(errors.join()).toMatch(/main/);
  });

  it("rejects a stray top-level export (silently flips to module mode)", () => {
    const errors = validateExample({
      ...valid,
      code: `${valid.code}\nexport const extra = 1;`,
    });
    expect(errors.join()).toMatch(/module mode/);
  });

  it("rejects import statements (replicad is ambient)", () => {
    const errors = validateExample({
      ...valid,
      code: `import { drawCircle } from "replicad";\nconst main = () => drawCircle(20);`,
    });
    expect(errors.join()).toMatch(/ambient/);
  });

  it("rejects direct access to the shared OpenCascade virtual FS", () => {
    const errors = validateExample({
      ...valid,
      code: `const main = () => { oc.FS.writeFile("x.brep", ""); return replicad.drawCircle(1); };`,
    });
    expect(errors.join()).toMatch(/virtual FS/);
  });

  it("rejects non-kebab-case ids", () => {
    expect(validateExample({ ...valid, id: "DrawCircle" }).join()).toMatch(
      /kebab-case/,
    );
  });

  it("rejects a missing entry point (R4)", () => {
    expect(validateExample({ ...valid, entryPoint: "  " }).join()).toMatch(
      /entryPoint is required/,
    );
  });
});

describe("lintExamples", () => {
  it("rejects duplicate ids", () => {
    expect(() => lintExamples([valid, { ...valid, title: "Again" }])).toThrow(
      /duplicate example id "draw-circle"/,
    );
  });

  it("reports every violation at once", () => {
    const broken: Example = { ...valid, id: "Bad Id", code: "nothing here" };
    expect(() => lintExamples([broken])).toThrow(/kebab-case[\s\S]*main/);
  });

  it("passes on the real registry", () => {
    expect(() => lintExamples(examples)).not.toThrow();
  });
});
