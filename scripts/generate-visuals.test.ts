import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { Example } from "../src/examples/index";
import {
  cacheKey,
  generateVisuals,
  generateVisualsInBatches,
  seededShuffle,
  type Manifest,
} from "./generate-visuals";
import { diffManifests } from "./check-order";
import { syntheticCorpus } from "./check-scale";

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

const rectangle: Example = {
  ...sample,
  id: "another-rectangle",
  code: `const main = () => {
  const { drawRectangle } = replicad;
  return drawRectangle(10, 6);
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

  it("reuses cached entries on an unchanged re-run and re-renders on code change (v1.1 cache)", async () => {
    const outDir = await tempOutDir();
    const first = await generateVisuals([sample], outDir);
    expect(first.entries[0].keyHash).toBe(cacheKey(sample));

    const actions: string[] = [];
    const second = await generateVisuals([sample], outDir, {
      onExample: (_id, action) => actions.push(action),
    });
    expect(actions).toEqual(["cache"]);
    expect(second.entries[0].visuals).toEqual(first.entries[0].visuals);

    const changed: Example = {
      ...sample,
      code: `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(30);
};`,
    };
    actions.length = 0;
    const third = await generateVisuals([changed], outDir, {
      onExample: (_id, action) => actions.push(action),
    });
    expect(actions).toEqual(["render"]);
    expect(third.entries[0].keyHash).not.toBe(first.entries[0].keyHash);
  });

  it("re-renders everything under force", async () => {
    const outDir = await tempOutDir();
    await generateVisuals([sample], outDir);

    const actions: string[] = [];
    await generateVisuals([sample], outDir, {
      force: true,
      onExample: (_id, action) => actions.push(action),
    });
    expect(actions).toEqual(["render"]);
  });

  it("keeps manifest entries in registry order even when rendering shuffled", async () => {
    const manifest = await generateVisuals([sample, rectangle], await tempOutDir(), {
      shuffleSeed: 7,
    });
    expect(manifest.entries.map((entry) => entry.id)).toEqual([
      "sample-circle",
      "another-rectangle",
    ]);
  });
});

describe("generateVisualsInBatches", () => {
  it("renders across recycled child processes and merges in registry order", async () => {
    const outDir = await tempOutDir();
    const { manifest, stats } = await generateVisualsInBatches(
      [sample, rectangle],
      outDir,
      1,
      { force: true },
    );

    expect(stats.batches).toEqual([["sample-circle"], ["another-rectangle"]]);
    expect(stats.maxRssKb).toHaveLength(2);
    expect(stats.maxRssKb.every((kb) => kb > 0)).toBe(true);
    expect(manifest.entries.map((entry) => entry.id)).toEqual([
      "sample-circle",
      "another-rectangle",
    ]);
    expect(manifest.entries[0].visuals[0].svg).toContain("<path");
  });

  it("rejects a non-positive batch size instead of looping forever", async () => {
    await expect(
      generateVisualsInBatches([sample], await tempOutDir(), 0),
    ).rejects.toThrow(/batch size/);
    await expect(
      generateVisualsInBatches([sample], await tempOutDir(), Number.NaN),
    ).rejects.toThrow(/batch size/);
  });
});

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("is deterministic per seed and does not mutate its input", () => {
    const one = seededShuffle(items, 42);
    const two = seededShuffle(items, 42);
    expect(one).toEqual(two);
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect([...one].sort()).toEqual([...items].sort());
  });

  it("actually reorders (a shuffle that never shuffles would gut the leakage check)", () => {
    expect(seededShuffle(items, 1).join("")).not.toBe(items.join(""));
  });
});

describe("diffManifests", () => {
  const manifestWith = (kind: "2d" | "3d", svg: string): Manifest => ({
    replicadRef: "ref",
    replicadTag: "tag",
    entries: [
      {
        id: "x",
        title: "X",
        entryPoint: "x()",
        group: "g",
        commonness: "COMMON",
        code: "code",
        keyHash: "k",
        studioUrl: "different-per-run-is-fine",
        visuals: [{ kind, name: "Shape", svg }],
      },
    ],
  });

  const svg = (body: string) => `<svg viewBox="0 0 10 10">${body}</svg>`;

  it("passes identical output and ignores studio URLs", () => {
    expect(
      diffManifests(
        manifestWith("2d", svg('<path d="M 0 0 L 1 1" />')),
        manifestWith("2d", svg('<path d="M 0 0 L 1 1" />')),
      ),
    ).toEqual([]);
  });

  it("flags byte differences on 2D visuals (analytic output must be stable)", () => {
    expect(
      diffManifests(
        manifestWith("2d", svg('<path d="M 0 0 L 1 1" />')),
        manifestWith("2d", svg('<path d="M 0 0 L 1 2" />')),
      ),
    ).toEqual(["x: visual 0 geometry differs between render orders"]);
  });

  it("tolerates 3D path re-segmentation but flags real geometry differences", () => {
    // same vertices, split into two paths — OCCT HLR segmentation jitter
    const merged = manifestWith("3d", svg('<path d="M 0 0 L 1 1 L 2 0" />'));
    const split = manifestWith(
      "3d",
      svg('<path d="M 0 0 L 1 1" /><path d="M 1 1 L 2 0" />'),
    );
    expect(diffManifests(merged, split)).toEqual([]);

    const moved = manifestWith("3d", svg('<path d="M 0 0 L 1 1 L 3 0" />'));
    expect(diffManifests(merged, moved)).toEqual([
      "x: visual 0 geometry differs between render orders",
    ]);
  });
});

describe("syntheticCorpus", () => {
  it("produces the requested size with unique ids and unique code", () => {
    const corpus = syntheticCorpus(300);
    expect(corpus).toHaveLength(300);
    expect(new Set(corpus.map((example) => example.id)).size).toBe(300);
    // unique code strings — the cache must not be able to shortcut the scale test
    expect(new Set(corpus.map((example) => example.code)).size).toBe(300);
  });
});
