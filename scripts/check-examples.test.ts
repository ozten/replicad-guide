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
