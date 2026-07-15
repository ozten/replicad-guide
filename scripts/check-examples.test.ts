import { describe, expect, it } from "vitest";
import type { Example } from "../src/examples/index";
import { checkExamples } from "./check-examples";

const base = {
  title: "Test example",
  entryPoint: "test()",
  group: "test",
  commonness: "ESSENTIAL",
} as const;

const clean: Example = {
  ...base,
  id: "clean-circle",
  code: `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`,
};

const throwing: Example = {
  ...base,
  id: "throwing-example",
  code: `const main = () => { throw new Error("kaboom"); };`,
};

const stderrOnly: Example = {
  ...base,
  id: "stderr-example",
  code: `const main = () => {
  console.error("stray diagnostics");
  return replicad.drawCircle(5);
};`,
};

describe("checkExamples", () => {
  it("passes a clean example", async () => {
    expect(await checkExamples([clean])).toEqual([]);
  });

  it("reports a throwing example, naming the id", async () => {
    const failures = await checkExamples([throwing]);

    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("throwing-example");
    expect(failures[0].problems.join("\n")).toMatch(
      /\[throwing-example\].*kaboom/,
    );
  });

  it("fails an example that renders fine but writes to console.error", async () => {
    const failures = await checkExamples([stderrOnly]);

    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("stderr-example");
    expect(failures[0].problems.join("\n")).toMatch(
      /console\.error: stray diagnostics/,
    );
  });

  it("does not fail an example that only writes to console.warn", async () => {
    const warnOnly: Example = {
      ...base,
      id: "warn-example",
      code: `const main = () => {
  console.warn("heads up, not an error");
  return replicad.drawCircle(5);
};`,
    };

    expect(await checkExamples([warnOnly])).toEqual([]);
  });

  it("attaches captured warnings as context when the example fails", async () => {
    const warnThenThrow: Example = {
      ...base,
      id: "warn-then-throw",
      code: `const main = () => {
  console.warn("about to break");
  throw new Error("kaboom");
};`,
    };

    const failures = await checkExamples([warnThenThrow]);

    expect(failures[0].problems.join("\n")).toMatch(
      /console\.warn: about to break/,
    );
  });

  it("reports per-example pass/fail through the onExample callback", async () => {
    const seen: Array<[string, boolean]> = [];

    await checkExamples([clean, throwing], (id, ok) => seen.push([id, ok]));

    expect(seen).toEqual([
      ["clean-circle", true],
      ["throwing-example", false],
    ]);
  });

  it("reports every broken example, not just the first", async () => {
    const alsoBroken: Example = {
      ...base,
      id: "also-broken",
      code: `const main = () => [];`,
    };

    const failures = await checkExamples([throwing, clean, alsoBroken]);

    expect(failures.map((f) => f.id)).toEqual(["throwing-example", "also-broken"]);
  });
});
