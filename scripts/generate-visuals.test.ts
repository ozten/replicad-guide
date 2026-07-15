import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { Example } from "../src/examples/index";
import { generateVisuals } from "./generate-visuals";

const sample: Example = {
  id: "sample-circle",
  title: "Sample circle",
  entryPoint: "drawCircle(radius) → Drawing",
  group: "test",
  commonness: "ESSENTIAL",
  code: `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`,
};

let tempDir: string | null = null;

async function tempOutDir(): Promise<URL> {
  tempDir = await mkdtemp(join(tmpdir(), "generate-visuals-"));
  return pathToFileURL(`${tempDir}/`);
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("generateVisuals", () => {
  it("writes a manifest whose entry code is the record's code, character for character (R9)", async () => {
    const outDir = await tempOutDir();
    const manifest = await generateVisuals([sample], outDir);

    expect(manifest.entries).toHaveLength(1);
    const entry = manifest.entries[0];
    expect(entry.code).toBe(sample.code);
    expect(entry.visuals[0].kind).toBe("2d");
    expect(entry.visuals[0].svg).toContain("<path");
    expect(entry.studioUrl).toContain("studio.replicad.xyz");

    // the manifest on disk carries the same single source of truth
    const onDisk = JSON.parse(
      await readFile(new URL("manifest.json", outDir), "utf8"),
    );
    expect(onDisk.entries[0].code).toBe(sample.code);
    expect(onDisk.replicadRef).toBeTruthy();
  });

  it("fails the run naming the id when an example breaks", async () => {
    const broken: Example = {
      ...sample,
      id: "broken-example",
      code: `const main = () => { throw new Error("kaboom"); };`,
    };

    await expect(
      generateVisuals([sample, broken], await tempOutDir()),
    ).rejects.toThrow(/broken-example[\s\S]*kaboom/);
  });

  it("fails when an example violates the contract lint", async () => {
    const noMain: Example = {
      ...sample,
      id: "no-main",
      code: `const model = () => replicad.drawCircle(2);`,
    };

    await expect(
      generateVisuals([noMain], await tempOutDir()),
    ).rejects.toThrow(/no-main.*main/);
  });
});
