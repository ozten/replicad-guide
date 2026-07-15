/**
 * Shuffled-order leakage check (U8/v1.1): renders the full example corpus
 * twice in two FRESH processes — once in registry order, once in a
 * seeded-shuffled order — and asserts the visuals are identical per id.
 * Any cross-example state leak (shared globalThis, OC virtual FS,
 * shapesMemory) that makes output depend on render order fails here,
 * naming the differing examples.
 *
 * Studio URLs are excluded from the comparison: JSZip embeds file
 * timestamps, so they differ per run by design; leakage would corrupt
 * geometry, i.e. the visuals.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifest } from "./generate-visuals";

const generateScript = fileURLToPath(
  new URL("generate-visuals.ts", import.meta.url),
);

async function renderInFreshProcess(shuffleSeed?: number): Promise<Manifest> {
  const outDir = await mkdtemp(join(tmpdir(), "check-order-"));
  try {
    execFileSync(
      process.execPath,
      [
        ...process.execArgv,
        generateScript,
        "--force",
        // single process per pass: order must be the only variable
        "--batch-size",
        "1000000",
        "--out",
        outDir,
        ...(shuffleSeed === undefined
          ? []
          : ["--shuffle-seed", String(shuffleSeed)]),
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    return JSON.parse(await readFile(join(outDir, "manifest.json"), "utf8"));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

/**
 * Canonical geometry fingerprint of a projection SVG: the deduplicated set
 * of numeric coordinates/parameters across all path data, plus the viewbox.
 *
 * Needed because OCCT's hidden-line stitching iterates pointer-keyed
 * structures: the SAME geometry can be segmented into paths differently
 * depending on heap layout left by preceding examples (observed on the
 * `shell` example — 37 paths either way, same vertices, different
 * grouping). Segmentation is visually irrelevant; a real leak (the wrong
 * shape projected, changed dimensions) changes the vertex set.
 */
export function geometryFingerprint(svg: string): string {
  const viewbox = svg.match(/viewBox="([^"]*)"/)?.[1] ?? "";
  const numbers = new Set<string>();
  for (const path of svg.matchAll(/\bd="([^"]*)"/g)) {
    for (const value of path[1].match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []) {
      numbers.add(Number(value).toFixed(6));
    }
  }
  return `${viewbox}|${[...numbers].sort().join(",")}`;
}

export function diffManifests(sorted: Manifest, shuffled: Manifest): string[] {
  const shuffledById = new Map(
    shuffled.entries.map((entry) => [entry.id, entry]),
  );
  const problems: string[] = [];

  for (const entry of sorted.entries) {
    const other = shuffledById.get(entry.id);
    if (!other) {
      problems.push(`${entry.id}: missing from the shuffled render`);
      continue;
    }
    if (entry.visuals.length !== other.visuals.length) {
      problems.push(
        `${entry.id}: visual count differs between render orders (${entry.visuals.length} vs ${other.visuals.length})`,
      );
      continue;
    }
    for (const [index, visual] of entry.visuals.entries()) {
      const otherVisual = other.visuals[index];
      if (visual.kind !== otherVisual.kind || visual.name !== otherVisual.name) {
        problems.push(`${entry.id}: visual ${index} kind/name differs between render orders`);
        continue;
      }
      if (visual.svg === otherVisual.svg) continue;
      // 2D drawings are computed analytically and must be byte-stable; 3D
      // projections may only differ in path segmentation (see above)
      if (
        visual.kind === "2d" ||
        geometryFingerprint(visual.svg) !== geometryFingerprint(otherVisual.svg)
      ) {
        problems.push(`${entry.id}: visual ${index} geometry differs between render orders`);
      }
    }
  }
  return problems;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const seed = Number(process.argv[2] ?? 1);
  console.log("check-order: pass 1/2 — registry order");
  const sorted = await renderInFreshProcess();
  console.log(`check-order: pass 2/2 — shuffled order (seed ${seed})`);
  const shuffled = await renderInFreshProcess(seed);

  const problems = diffManifests(sorted, shuffled);
  if (problems.length > 0) {
    console.error(
      `✗ render output depends on example order — cross-example leakage:\n${problems
        .map((p) => `  - ${p}`)
        .join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `✓ ${sorted.entries.length} example(s) render identically in registry and shuffled order`,
  );
}
